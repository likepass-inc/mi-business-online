import { fetchGA4Data } from '@/lib/ga4Client'
import type { DateRange } from '@/lib/types'
import type { MonthlyFunnelSnapshot, MonthlyFunnelStep } from '@/lib/monthlyChartsTypes'

function sumMetric(
  rows: Array<Record<string, string | number>>,
  key: string
): number {
  return rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0)
}

function buildSteps(
  values: Array<{ id: string; label: string; value: number }>
): MonthlyFunnelSnapshot {
  const steps: MonthlyFunnelStep[] = values.map((item, index) => {
    const prev = index === 0 ? item.value : values[index - 1].value
    const continueRate = index === 0 ? 100 : prev > 0 ? (item.value / prev) * 100 : 0
    const dropoffRate = index === 0 ? 0 : prev > 0 ? ((prev - item.value) / prev) * 100 : 0
    return {
      id: item.id,
      label: item.label,
      value: item.value,
      continueRate,
      dropoffRate,
    }
  })
  const first = values[0]?.value ?? 0
  const last = values[values.length - 1]?.value ?? 0
  return {
    steps,
    overallConversionRate: first > 0 ? (last / first) * 100 : 0,
  }
}

/**
 * 集客→購入ファネル（サイト全体）。暦月1本分。
 * セッション系は sessions、カートは eventCount、購入は purchase 完了イベント数。
 */
export async function buildFunnelForDateRange(
  dateRange: DateRange
): Promise<MonthlyFunnelSnapshot> {
  const [
    siteSessions,
    organicSessions,
    magazineSessions,
    shopSessions,
    addToCart,
    purchases,
  ] = await Promise.all([
    fetchGA4Data({
      dateRange,
      metrics: ['sessions'],
    }),
    fetchGA4Data({
      dateRange,
      metrics: ['sessions'],
      dimensions: ['sessionDefaultChannelGroup'],
      filters: [
        {
          field: 'sessionDefaultChannelGroup',
          operator: 'EXACT',
          value: 'Organic Search',
        },
      ],
    }),
    fetchGA4Data({
      dateRange,
      metrics: ['sessions'],
      dimensions: ['pagePath'],
      filters: [{ field: 'pagePath', operator: 'CONTAINS', value: '/magazine/' }],
    }),
    fetchGA4Data({
      dateRange,
      metrics: ['sessions'],
      dimensions: ['pagePath'],
      filters: [{ field: 'pagePath', operator: 'CONTAINS', value: '/shop/' }],
    }),
    fetchGA4Data({
      dateRange,
      metrics: ['eventCount'],
      dimensions: ['eventName'],
      filters: [{ field: 'eventName', operator: 'EXACT', value: 'add_to_cart' }],
    }),
    fetchGA4Data({
      dateRange,
      metrics: ['eventCount'],
      dimensions: ['eventName'],
      filters: [
        { field: 'eventName', operator: 'EXACT', value: 'purchase_completed' },
      ],
    }),
  ])

  let purchaseCount = sumMetric(purchases.rows, 'eventCount')
  if (purchaseCount === 0) {
    const purchaseFallback = await fetchGA4Data({
      dateRange,
      metrics: ['eventCount'],
      dimensions: ['eventName'],
      filters: [{ field: 'eventName', operator: 'EXACT', value: 'purchase' }],
    })
    purchaseCount = sumMetric(purchaseFallback.rows, 'eventCount')
  }

  return buildSteps([
    {
      id: 'site_sessions',
      label: 'サイトセッション',
      value: sumMetric(siteSessions.rows, 'sessions'),
    },
    {
      id: 'organic_sessions',
      label: 'Organic Search',
      value: sumMetric(organicSessions.rows, 'sessions'),
    },
    {
      id: 'magazine_sessions',
      label: 'マガジン閲覧',
      value: sumMetric(magazineSessions.rows, 'sessions'),
    },
    {
      id: 'shop_sessions',
      label: 'ショップ閲覧',
      value: sumMetric(shopSessions.rows, 'sessions'),
    },
    {
      id: 'add_to_cart',
      label: 'カート追加',
      value: sumMetric(addToCart.rows, 'eventCount'),
    },
    {
      id: 'purchase',
      label: '購入完了',
      value: purchaseCount,
    },
  ])
}

export async function buildMonthlyFunnel(options: {
  monthStart: string
  monthEnd: string
  yoyMonthStart: string
  yoyMonthEnd: string
}): Promise<{ current: MonthlyFunnelSnapshot; yearAgo: MonthlyFunnelSnapshot }> {
  const [current, yearAgo] = await Promise.all([
    buildFunnelForDateRange({
      startDate: options.monthStart,
      endDate: options.monthEnd,
    }),
    buildFunnelForDateRange({
      startDate: options.yoyMonthStart,
      endDate: options.yoyMonthEnd,
    }),
  ])
  return { current, yearAgo }
}

/** 既存 conversion-path API 互換（マガジン→ショップ→カート→購入） */
export async function buildLegacyConversionPath(dateRange: DateRange) {
  const funnel = await buildFunnelForDateRange(dateRange)
  const byId = Object.fromEntries(funnel.steps.map((s) => [s.id, s]))
  const magazine = byId.magazine_sessions?.value ?? 0
  const shop = byId.shop_sessions?.value ?? 0
  const cart = byId.add_to_cart?.value ?? 0
  const purchase = byId.purchase?.value ?? 0

  const steps = [
    {
      step: 'マガジン記事閲覧',
      users: magazine,
      dropoffRate: magazine > 0 ? ((magazine - shop) / magazine) * 100 : 0,
      conversionRate: 0,
    },
    {
      step: '商品ページ閲覧',
      users: shop,
      dropoffRate: shop > 0 ? ((shop - cart) / shop) * 100 : 0,
      conversionRate: 0,
    },
    {
      step: 'カート追加',
      users: cart,
      dropoffRate: cart > 0 ? ((cart - purchase) / cart) * 100 : 0,
      conversionRate: 0,
    },
    {
      step: '購入完了',
      users: purchase,
      dropoffRate: 0,
      conversionRate: magazine > 0 ? (purchase / magazine) * 100 : 0,
    },
  ]

  return {
    steps,
    totalConversions: purchase,
    overallConversionRate: magazine > 0 ? (purchase / magazine) * 100 : 0,
  }
}
