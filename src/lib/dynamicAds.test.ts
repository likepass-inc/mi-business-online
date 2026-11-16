import assert from 'node:assert/strict'
import {
  buildCampaignBreakdown,
  buildPlacementBreakdown,
  classifyDynamicAdContent,
  compareBreakdowns,
  conversionRate,
  formatCampaignName,
  summarizePurchases,
  summarizeTraffic,
} from './dynamicAds'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}`)
    throw e
  }
}

test('classifyDynamicAdContent maps lo01 and lo02 prefixes', () => {
  assert.equal(classifyDynamicAdContent('lo01-seibo_c00-pc'), 'retargeting')
  assert.equal(classifyDynamicAdContent('LO02-seibo_c00-sp'), 'valis')
  assert.equal(classifyDynamicAdContent('creative-lo01-extra'), 'retargeting')
  assert.equal(classifyDynamicAdContent('gd01-seibo_c00'), 'other')
  assert.equal(classifyDynamicAdContent(''), 'other')
})

test('formatCampaignName labels oseibo and leaves unknown campaigns raw', () => {
  assert.equal(formatCampaignName('oseibo'), 'oseibo（歳暮）')
  assert.equal(formatCampaignName('OSEIBO'), 'OSEIBO（歳暮）')
  assert.equal(formatCampaignName('ochugen'), 'ochugen')
  assert.equal(formatCampaignName(''), '未設定')
  assert.equal(formatCampaignName('(not set)'), '未設定')
})

test('summarizeTraffic rounds revenue and summarizePurchases sums event counts', () => {
  assert.deepEqual(
    summarizeTraffic([
      { sessions: 10, purchaseRevenue: 100.4 },
      { sessions: 2, purchaseRevenue: 50.4 },
    ]),
    { sessions: 12, revenue: 151 }
  )
  assert.equal(summarizePurchases([{ eventCount: 3 }, { eventCount: 1 }]), 4)
  assert.equal(summarizePurchases([]), 0)
})

test('conversionRate is zero when there are no sessions', () => {
  assert.equal(conversionRate({ sessions: 0, purchases: 2 }), 0)
  assert.equal(conversionRate({ sessions: 50, purchases: 1 }), 2)
})

test('buildCampaignBreakdown merges traffic and purchases', () => {
  const rows = buildCampaignBreakdown(
    [
      { sessionCampaignName: 'oseibo', sessions: 8, purchaseRevenue: 1200.2 },
      { sessionCampaignName: 'ochugen', sessions: 3, purchaseRevenue: 400 },
    ],
    [
      { sessionCampaignName: 'oseibo', eventName: '購入完了', eventCount: 2 },
      { sessionCampaignName: '(not set)', eventName: '購入完了', eventCount: 1 },
    ]
  )
  assert.deepEqual(rows, [
    { key: 'oseibo', label: 'oseibo（歳暮）', sessions: 8, purchases: 2, revenue: 1200 },
    { key: 'ochugen', label: 'ochugen', sessions: 3, purchases: 0, revenue: 400 },
    { key: '(not set)', label: '未設定', sessions: 0, purchases: 1, revenue: 0 },
  ])
})

test('buildCampaignBreakdown sums content rows that share a campaign', () => {
  const rows = buildCampaignBreakdown(
    [
      { sessionCampaignName: 'oseibo', sessionManualAdContent: 'lo01-seibo_c00-pc', sessions: 2, purchaseRevenue: 100.2 },
      { sessionCampaignName: 'oseibo', sessionManualAdContent: 'lo02-seibo_c00-pc', sessions: 3, purchaseRevenue: 50.4 },
    ],
    [{ sessionCampaignName: 'oseibo', sessionManualAdContent: 'lo01-seibo_c00-pc', eventCount: 1 }]
  )
  assert.deepEqual(rows, [
    { key: 'oseibo', label: 'oseibo（歳暮）', sessions: 5, purchases: 1, revenue: 151 },
  ])
})

test('buildPlacementBreakdown groups lo01 and lo02 contents', () => {
  const rows = buildPlacementBreakdown(
    [
      { sessionManualAdContent: 'lo01-seibo_c00-pc', sessions: 4, purchaseRevenue: 800 },
      { sessionManualAdContent: 'lo01-seibo_c00-sp', sessions: 2, purchaseRevenue: 200.4 },
      { sessionManualAdContent: 'lo02-seibo_c00-im', sessions: 5, purchaseRevenue: 100 },
    ],
    [
      { sessionManualAdContent: 'lo01-seibo_c00-pc', eventCount: 1 },
      { sessionManualAdContent: 'lo02-seibo_c00-im', eventCount: 2 },
    ]
  )
  assert.deepEqual(rows, [
    { key: 'retargeting', label: 'リターゲティング', sessions: 6, purchases: 1, revenue: 1000 },
    { key: 'valis', label: 'VALIS-拡張', sessions: 5, purchases: 2, revenue: 100 },
  ])
})

test('compareBreakdowns keeps campaigns that exist only in the comparison period', () => {
  const rows = compareBreakdowns(
    [{ key: 'oseibo', label: 'oseibo（歳暮）', sessions: 4, purchases: 1, revenue: 500 }],
    [{ key: 'ochugen', label: 'ochugen', sessions: 9, purchases: 3, revenue: 900 }]
  )
  assert.deepEqual(rows, [
    {
      key: 'oseibo',
      label: 'oseibo（歳暮）',
      sessions: 4,
      purchases: 1,
      revenue: 500,
      previous: { sessions: 0, purchases: 0, revenue: 0 },
    },
    {
      key: 'ochugen',
      label: 'ochugen',
      sessions: 0,
      purchases: 0,
      revenue: 0,
      previous: { sessions: 9, purchases: 3, revenue: 900 },
    },
  ])
})

console.log('\nAll dynamicAds tests passed.')
