/**
 * 集客〜購入ファネルの代理指標を GA4 Data API から取得する。
 * 同一セッションの順序ファネルではなく、各ステップのセッション／イベント母数。
 *
 *   npx tsx scripts/analyze-purchase-funnel.ts
 */
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { fetchGA4Data } from '../src/lib/ga4Client'
import type { DateRange, GA4Filter } from '../src/lib/types'

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
}

const PERIODS = {
  chugen: { label: 'お中元', startDate: '2026-06-01', endDate: '2026-07-31' },
  normal: { label: '平年（8月）', startDate: '2026-08-01', endDate: '2026-08-31' },
} as const

const PAGE_STEPS: Array<{ key: string; label: string; value: string }> = [
  { key: 'magazine', label: 'マガジン', value: '/magazine/' },
  { key: 'pdp', label: '商品詳細', value: '/shop/g/' },
  { key: 'category', label: 'カテゴリ一覧', value: '/shop/c/' },
  { key: 'occasion', label: 'シーン一覧', value: '/shop/i/' },
  { key: 'feature', label: '特集', value: '/shop/o/' },
  { key: 'cart', label: 'カート', value: '/shop/cart/cart.aspx' },
  { key: 'login', label: 'ログイン', value: '/shop/customer/login.aspx' },
  { key: 'signup', label: '会員登録', value: '/shop/customer/authmail.aspx' },
  { key: 'addressBook', label: 'アドレス帳', value: '/shop/customer/addresslist.aspx' },
  { key: 'customer', label: '会員エリア', value: '/shop/customer/' },
  { key: 'order', label: '注文系 /shop/order/', value: '/shop/order/' },
  { key: 'cartDir', label: 'カート配下', value: '/shop/cart/' },
]

const LANDING_TYPES: Array<{ key: string; label: string; value: string }> = [
  { key: 'magazine', label: 'マガジン LP', value: '/magazine/' },
  { key: 'pdp', label: '商品詳細 LP', value: '/shop/g/' },
  { key: 'category', label: 'カテゴリ LP', value: '/shop/c/' },
  { key: 'occasion', label: 'シーン LP', value: '/shop/i/' },
  { key: 'feature', label: '特集 LP', value: '/shop/o/' },
  { key: 'cart', label: 'カート LP', value: '/shop/cart/' },
  { key: 'customer', label: '会員 LP', value: '/shop/customer/' },
]

const CHECKOUT_PATH_FILTERS = [
  '/shop/cart/',
  '/shop/order/',
  '/shop/customer/',
  'complete',
  'thanks',
]

const CONCURRENCY = 2
const MAX_RETRIES = 5

let active = 0
const waitQueue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (active < CONCURRENCY) {
    active += 1
    return Promise.resolve()
  }
  return new Promise((resolveSlot) => {
    waitQueue.push(() => {
      active += 1
      resolveSlot()
    })
  })
}

function releaseSlot() {
  active -= 1
  const next = waitQueue.shift()
  if (next) next()
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function runGa4(request: Parameters<typeof fetchGA4Data>[0]) {
  await acquireSlot()
  try {
    let lastError: unknown
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        return await fetchGA4Data(request)
      } catch (error) {
        lastError = error
        const message = error instanceof Error ? error.message : String(error)
        const retryable = /RESOURCE_EXHAUSTED|UNAVAILABLE|429|8 /i.test(message)
        if (!retryable || attempt === MAX_RETRIES - 1) throw error
        await sleep(1500 * (attempt + 1))
      }
    }
    throw lastError
  } finally {
    releaseSlot()
  }
}

function range(startDate: string, endDate: string): DateRange {
  return { startDate, endDate }
}

function sumMetric(rows: Record<string, string | number>[], metric: string): number {
  return rows.reduce((sum, row) => sum + Number(row[metric] || 0), 0)
}

function pageFilter(value: string): GA4Filter[] {
  return [{ field: 'pagePath', operator: 'CONTAINS', value }]
}

function landingFilter(value: string): GA4Filter[] {
  return [{ field: 'landingPage', operator: 'CONTAINS', value }]
}

function purchaseEventFilter(): GA4Filter[] {
  return [{ field: 'eventName', operator: 'EXACT', value: '購入完了' }]
}

async function fetchPeriod(startDate: string, endDate: string) {
  const dateRange = range(startDate, endDate)

  const [summary, events, purchaseRevenue, byChannel, byDevice, channelPurchases, devicePurchases] =
    await Promise.all([
      runGa4({
        dateRange,
        metrics: ['sessions', 'activeUsers', 'screenPageViews'],
      }),
      runGa4({
        dateRange,
        metrics: ['eventCount', 'totalRevenue'],
        dimensions: ['eventName'],
      }),
      runGa4({
        dateRange,
        metrics: ['purchaseRevenue'],
      }),
      runGa4({
        dateRange,
        metrics: ['sessions', 'activeUsers', 'purchaseRevenue'],
        dimensions: ['sessionDefaultChannelGroup'],
      }),
      runGa4({
        dateRange,
        metrics: ['sessions', 'activeUsers', 'purchaseRevenue'],
        dimensions: ['deviceCategory'],
      }),
      runGa4({
        dateRange,
        metrics: ['eventCount'],
        dimensions: ['sessionDefaultChannelGroup', 'eventName'],
        filters: purchaseEventFilter(),
      }),
      runGa4({
        dateRange,
        metrics: ['eventCount'],
        dimensions: ['deviceCategory', 'eventName'],
        filters: purchaseEventFilter(),
      }),
    ])

  const stepJobs = PAGE_STEPS.map((step) => async () => {
    const data = await runGa4({
      dateRange,
      metrics: ['sessions', 'screenPageViews'],
      filters: pageFilter(step.value),
    })
    return {
      key: step.key,
      label: step.label,
      path: step.value,
      sessions: sumMetric(data.rows, 'sessions'),
      pageViews: sumMetric(data.rows, 'screenPageViews'),
    }
  })

  const landingJobs = LANDING_TYPES.map((lp) => async () => {
    const [sessions, purchases] = await Promise.all([
      runGa4({
        dateRange,
        metrics: ['sessions'],
        filters: landingFilter(lp.value),
      }),
      runGa4({
        dateRange,
        metrics: ['eventCount'],
        filters: [...landingFilter(lp.value), ...purchaseEventFilter()],
      }),
    ])
    const sessionCount = sumMetric(sessions.rows, 'sessions')
    const purchaseCount = sumMetric(purchases.rows, 'eventCount')
    return {
      key: lp.key,
      label: lp.label,
      path: lp.value,
      sessions: sessionCount,
      purchases: purchaseCount,
      cvr: sessionCount > 0 ? (purchaseCount / sessionCount) * 100 : 0,
    }
  })

  const checkoutJobs = CHECKOUT_PATH_FILTERS.map((value) => async () => {
    const data = await runGa4({
      dateRange,
      metrics: ['sessions', 'screenPageViews'],
      dimensions: ['pagePath'],
      filters: pageFilter(value),
    })
    const rows = data.rows
      .map((row) => ({
        pagePath: String(row.pagePath || ''),
        sessions: Number(row.sessions || 0),
        pageViews: Number(row.screenPageViews || 0),
      }))
      .sort((a, b) => b.sessions - a.sessions)
    return { filter: value, rows: rows.slice(0, 40) }
  })

  const deviceStepKeys = ['magazine', 'pdp', 'cart', 'login', 'signup', 'customer'] as const
  const deviceStepJobs = deviceStepKeys.map((key) => async () => {
    const step = PAGE_STEPS.find((s) => s.key === key)
    if (!step) throw new Error(`missing step ${key}`)
    const data = await runGa4({
      dateRange,
      metrics: ['sessions'],
      dimensions: ['deviceCategory'],
      filters: pageFilter(step.value),
    })
    return {
      key,
      label: step.label,
      byDevice: data.rows
        .map((row) => ({
          device: String(row.deviceCategory || ''),
          sessions: Number(row.sessions || 0),
        }))
        .sort((a, b) => b.sessions - a.sessions),
    }
  })

  const landingTopJob = async () => {
    const data = await runGa4({
      dateRange,
      metrics: ['sessions'],
      dimensions: ['landingPage'],
    })
    return data.rows
      .map((row) => ({
        landingPage: String(row.landingPage || ''),
        sessions: Number(row.sessions || 0),
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 30)
  }

  const landingPurchaseTopJob = async () => {
    const data = await runGa4({
      dateRange,
      metrics: ['eventCount'],
      dimensions: ['landingPage'],
      filters: purchaseEventFilter(),
    })
    return data.rows
      .map((row) => ({
        landingPage: String(row.landingPage || ''),
        purchases: Number(row.eventCount || 0),
      }))
      .sort((a, b) => b.purchases - a.purchases)
      .slice(0, 30)
  }

  const [steps, landingTypes, checkoutPages, deviceSteps, landingTop, landingPurchaseTop] =
    await Promise.all([
      Promise.all(stepJobs.map((job) => job())),
      Promise.all(landingJobs.map((job) => job())),
      Promise.all(checkoutJobs.map((job) => job())),
      Promise.all(deviceStepJobs.map((job) => job())),
      landingTopJob(),
      landingPurchaseTopJob(),
    ])

  const summaryRow = summary.rows[0] || {}
  const purchaseRow = events.rows.find((row) => row.eventName === '購入完了')
  const transactions = Number(purchaseRow?.eventCount || 0)
  const sessions = Number(summaryRow.sessions || 0)

  const channelPurchaseMap = new Map(
    channelPurchases.rows.map((row) => [
      String(row.sessionDefaultChannelGroup || ''),
      Number(row.eventCount || 0),
    ])
  )
  const devicePurchaseMap = new Map(
    devicePurchases.rows.map((row) => [
      String(row.deviceCategory || ''),
      Number(row.eventCount || 0),
    ])
  )

  return {
    period: { startDate, endDate },
    summary: {
      sessions,
      users: Number(summaryRow.activeUsers || 0),
      pageViews: Number(summaryRow.screenPageViews || 0),
      transactions,
      revenue: Math.round(Number(purchaseRevenue.rows[0]?.purchaseRevenue || 0)),
      cvr: sessions > 0 ? (transactions / sessions) * 100 : 0,
    },
    events: events.rows
      .map((row) => ({
        eventName: String(row.eventName || ''),
        eventCount: Number(row.eventCount || 0),
        totalRevenue: Number(row.totalRevenue || 0),
      }))
      .sort((a, b) => b.eventCount - a.eventCount),
    steps,
    landingTypes,
    checkoutPages,
    deviceSteps,
    landingTop,
    landingPurchaseTop,
    byChannel: byChannel.rows
      .map((row) => {
        const channel = String(row.sessionDefaultChannelGroup || '')
        const channelSessions = Number(row.sessions || 0)
        const purchases = channelPurchaseMap.get(channel) || 0
        return {
          channel,
          sessions: channelSessions,
          users: Number(row.activeUsers || 0),
          purchases,
          revenue: Math.round(Number(row.purchaseRevenue || 0)),
          cvr: channelSessions > 0 ? (purchases / channelSessions) * 100 : 0,
        }
      })
      .sort((a, b) => b.sessions - a.sessions),
    byDevice: byDevice.rows
      .map((row) => {
        const device = String(row.deviceCategory || '')
        const deviceSessions = Number(row.sessions || 0)
        const purchases = devicePurchaseMap.get(device) || 0
        return {
          device,
          sessions: deviceSessions,
          users: Number(row.activeUsers || 0),
          purchases,
          revenue: Math.round(Number(row.purchaseRevenue || 0)),
          cvr: deviceSessions > 0 ? (purchases / deviceSessions) * 100 : 0,
        }
      })
      .sort((a, b) => b.sessions - a.sessions),
  }
}

async function main() {
  console.log('Fetching GA4 funnel proxy metrics...')
  const chugen = await fetchPeriod(PERIODS.chugen.startDate, PERIODS.chugen.endDate)
  console.log(`  ${PERIODS.chugen.label}: sessions ${chugen.summary.sessions.toLocaleString()}`)
  const normal = await fetchPeriod(PERIODS.normal.startDate, PERIODS.normal.endDate)
  console.log(`  ${PERIODS.normal.label}: sessions ${normal.summary.sessions.toLocaleString()}`)

  const payload = {
    generatedAt: new Date().toISOString(),
    note: 'ステップ値は同一セッション順序ではなく、該当 pagePath / event を含むセッションまたはイベント件数。',
    periods: PERIODS,
    chugen,
    normal,
  }

  const outPath = resolve(process.cwd(), 'docs/funnel-analysis-raw.json')
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8')
  console.log(`Wrote ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
