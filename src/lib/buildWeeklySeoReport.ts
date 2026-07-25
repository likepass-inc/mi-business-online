import { fetchGA4Data } from '@/lib/ga4Client'
import { fetchGSCData } from '@/lib/gscClient'
import { getWeeklySeoPeriod } from '@/lib/dateUtils'
import type { GA4Filter } from '@/lib/types'

export interface GscQueryRanking {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface Ga4SegmentSummary {
  label: string
  sessions: number
  transactions: number
  revenue: number
  cvr: number
}

export interface LandingPageMetric {
  path: string
  sessions: number
  transactions: number
  revenue: number
  cvr: number
}

export interface WeeklySeoReport {
  siteUrl: string
  weekStart: string
  weekEnd: string
  weekKey: string
  yoyWeekStart: string
  yoyWeekEnd: string
  magazinePrefix: string
  gsc: {
    topQueries: GscQueryRanking[]
  }
  ga4: {
    sessions: number
    transactions: number
    revenue: number
    yoyPercent: {
      sessions: number | null
      transactions: number | null
      revenue: number | null
    }
  }
  ga4Segments: Ga4SegmentSummary[]
  landingPages: {
    topBySessions: { all: LandingPageMetric[]; magazine: LandingPageMetric[] }
    topByCv: { all: LandingPageMetric[]; magazine: LandingPageMetric[] }
  }
}

const LANDING_TOP_N = 5
const PURCHASE_KEY_EVENT = '購入完了'

function getMagazinePrefix(): string {
  return (
    process.env.SEO_WEEKLY_MAGAZINE_PREFIX ??
    process.env.SEO_DAILY_MAGAZINE_PREFIX ??
    '/magazine/'
  )
}

function calcCvr(sessions: number, transactions: number): number {
  if (sessions === 0) return 0
  return Math.round((transactions / sessions) * 10000) / 100
}

function isMagazineLanding(path: string, prefix: string): boolean {
  return path.includes(prefix)
}

function calculateYoYPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function dateRange(startDate: string, endDate: string) {
  return { startDate, endDate }
}

async function fetchGscTopQueries(
  startDate: string,
  endDate: string,
  limit = 10
): Promise<GscQueryRanking[]> {
  const { rows } = await fetchGSCData({
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: 1000,
  })

  return rows
    .map((row) => ({
      query: row.query || '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 10000) / 100,
      position: Math.round(row.position * 100) / 100,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit)
}

async function fetchSegmentKpi(
  startDate: string,
  endDate: string,
  filters?: GA4Filter[]
): Promise<{ sessions: number; transactions: number; revenue: number }> {
  const range = dateRange(startDate, endDate)
  const purchaseFilter: GA4Filter = {
    field: 'eventName',
    operator: 'EXACT',
    value: PURCHASE_KEY_EVENT,
  }

  const [summary, purchaseRevenue, keyEvents] = await Promise.all([
    fetchGA4Data({
      dateRange: range,
      metrics: ['sessions'],
      filters,
    }),
    fetchGA4Data({
      dateRange: range,
      metrics: ['purchaseRevenue'],
      filters,
    }),
    fetchGA4Data({
      dateRange: range,
      metrics: ['keyEvents'],
      filters: [...(filters ?? []), purchaseFilter],
    }),
  ])

  return {
    sessions: Number(summary.rows[0]?.sessions ?? 0),
    revenue: Math.round(Number(purchaseRevenue.rows[0]?.purchaseRevenue ?? 0)),
    transactions: Number(keyEvents.rows[0]?.keyEvents ?? 0),
  }
}

function toSegmentSummary(
  label: string,
  kpi: { sessions: number; transactions: number; revenue: number }
): Ga4SegmentSummary {
  return {
    label,
    sessions: kpi.sessions,
    transactions: kpi.transactions,
    revenue: kpi.revenue,
    cvr: calcCvr(kpi.sessions, kpi.transactions),
  }
}

async function fetchSegmentSummaries(
  startDate: string,
  endDate: string,
  magazinePrefix: string
): Promise<Ga4SegmentSummary[]> {
  const range = dateRange(startDate, endDate)
  const magazineFilter: GA4Filter = {
    field: 'landingPage',
    operator: 'CONTAINS',
    value: magazinePrefix,
  }
  const purchaseFilter: GA4Filter = {
    field: 'eventName',
    operator: 'EXACT',
    value: PURCHASE_KEY_EVENT,
  }

  const [total, magazine] = await Promise.all([
    fetchSegmentKpi(startDate, endDate),
    fetchSegmentKpi(startDate, endDate, [magazineFilter]),
  ])

  const [sessionsByLp, keyEventsByLp] = await Promise.all([
    fetchGA4Data({
      dateRange: range,
      dimensions: ['landingPage'],
      metrics: ['sessions'],
    }),
    fetchGA4Data({
      dateRange: range,
      dimensions: ['landingPage'],
      metrics: ['keyEvents'],
      filters: [purchaseFilter],
    }),
  ])

  let nonMagSessions = 0
  let nonMagTransactions = 0
  for (const row of sessionsByLp.rows) {
    const path = String(row.landingPage ?? '')
    if (!isMagazineLanding(path, magazinePrefix)) {
      nonMagSessions += Number(row.sessions ?? 0)
    }
  }
  for (const row of keyEventsByLp.rows) {
    const path = String(row.landingPage ?? '')
    if (!isMagazineLanding(path, magazinePrefix)) {
      nonMagTransactions += Number(row.keyEvents ?? 0)
    }
  }

  const nonMagazine = {
    sessions: nonMagSessions,
    transactions: nonMagTransactions,
    revenue: Math.max(0, total.revenue - magazine.revenue),
  }

  return [
    toSegmentSummary('トータル', total),
    toSegmentSummary('マガジンLP', magazine),
    toSegmentSummary('マガジン以外LP', nonMagazine),
  ]
}

async function fetchLandingPageMetrics(
  startDate: string,
  endDate: string,
  magazinePrefix: string
): Promise<WeeklySeoReport['landingPages']> {
  const range = dateRange(startDate, endDate)
  const purchaseFilter: GA4Filter = {
    field: 'eventName',
    operator: 'EXACT',
    value: PURCHASE_KEY_EVENT,
  }

  const [sessionsByLp, keyEventsByLp, revenueByLp] = await Promise.all([
    fetchGA4Data({
      dateRange: range,
      dimensions: ['landingPage'],
      metrics: ['sessions'],
    }),
    fetchGA4Data({
      dateRange: range,
      dimensions: ['landingPage'],
      metrics: ['keyEvents'],
      filters: [purchaseFilter],
    }),
    fetchGA4Data({
      dateRange: range,
      dimensions: ['landingPage'],
      metrics: ['purchaseRevenue'],
    }),
  ])

  const cvMap = new Map<string, number>()
  for (const row of keyEventsByLp.rows) {
    const path = String(row.landingPage ?? '')
    cvMap.set(path, Number(row.keyEvents ?? 0))
  }

  const revenueMap = new Map<string, number>()
  for (const row of revenueByLp.rows) {
    const path = String(row.landingPage ?? '')
    revenueMap.set(path, Math.round(Number(row.purchaseRevenue ?? 0)))
  }

  const paths = new Set<string>()
  for (const row of sessionsByLp.rows) paths.add(String(row.landingPage ?? ''))
  for (const row of keyEventsByLp.rows) paths.add(String(row.landingPage ?? ''))
  for (const row of revenueByLp.rows) paths.add(String(row.landingPage ?? ''))

  const all: LandingPageMetric[] = Array.from(paths)
    .filter((path) => path.length > 0)
    .map((path) => {
      const sessions =
        Number(sessionsByLp.rows.find((r) => String(r.landingPage ?? '') === path)?.sessions ?? 0)
      const transactions = cvMap.get(path) ?? 0
      const revenue = revenueMap.get(path) ?? 0
      return {
        path,
        sessions,
        transactions,
        revenue,
        cvr: calcCvr(sessions, transactions),
      }
    })
    .filter((r) => r.sessions > 0 || r.transactions > 0 || r.revenue > 0)

  const magazine = all.filter((r) => isMagazineLanding(r.path, magazinePrefix))

  const sortBySessions = (a: LandingPageMetric, b: LandingPageMetric) => b.sessions - a.sessions
  const sortByCv = (a: LandingPageMetric, b: LandingPageMetric) =>
    b.transactions - a.transactions || b.revenue - a.revenue || b.sessions - a.sessions

  return {
    topBySessions: {
      all: [...all].sort(sortBySessions).slice(0, LANDING_TOP_N),
      magazine: [...magazine].sort(sortBySessions).slice(0, LANDING_TOP_N),
    },
    topByCv: {
      all: [...all].sort(sortByCv).slice(0, LANDING_TOP_N),
      magazine: [...magazine].sort(sortByCv).slice(0, LANDING_TOP_N),
    },
  }
}

export async function buildWeeklySeoReport(): Promise<WeeklySeoReport> {
  const { weekStart, weekEnd, weekKey, yoyWeekStart, yoyWeekEnd } = getWeeklySeoPeriod()
  const siteUrl = process.env.GSC_SITE_URL || 'https://business.mistore.jp/'
  const magazinePrefix = getMagazinePrefix()

  const [topQueries, ga4Segments, landingPages, ga4Previous] = await Promise.all([
    fetchGscTopQueries(weekStart, weekEnd),
    fetchSegmentSummaries(weekStart, weekEnd, magazinePrefix),
    fetchLandingPageMetrics(weekStart, weekEnd, magazinePrefix),
    fetchSegmentKpi(yoyWeekStart, yoyWeekEnd),
  ])

  const totalSegment = ga4Segments.find((s) => s.label === 'トータル')!
  const ga4 = {
    sessions: totalSegment.sessions,
    transactions: totalSegment.transactions,
    revenue: totalSegment.revenue,
    yoyPercent: {
      sessions: calculateYoYPercent(totalSegment.sessions, ga4Previous.sessions),
      transactions: calculateYoYPercent(totalSegment.transactions, ga4Previous.transactions),
      revenue: calculateYoYPercent(totalSegment.revenue, ga4Previous.revenue),
    },
  }

  return {
    siteUrl,
    weekStart,
    weekEnd,
    weekKey,
    yoyWeekStart,
    yoyWeekEnd,
    magazinePrefix,
    gsc: { topQueries },
    ga4,
    ga4Segments,
    landingPages,
  }
}
