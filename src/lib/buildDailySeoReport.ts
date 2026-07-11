import { fetchGA4Data } from '@/lib/ga4Client'
import { fetchGSCData } from '@/lib/gscClient'
import { getDailySeoDates, getSameWeekdayLastYear } from '@/lib/dateUtils'
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

export interface DailySeoReport {
  siteUrl: string
  targetDate: string
  yoyCompareDate: string
  magazinePrefix: string
  gsc: {
    topQueries: GscQueryRanking[]
  }
  /** トータル KPI（後方互換 + 前年同曜日比） */
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

function getMagazinePrefix(): string {
  return process.env.SEO_DAILY_MAGAZINE_PREFIX ?? '/magazine/'
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

async function fetchGscTopQueries(date: string, limit = 10): Promise<GscQueryRanking[]> {
  const { rows } = await fetchGSCData({
    startDate: date,
    endDate: date,
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
  date: string,
  filters?: GA4Filter[]
): Promise<{ sessions: number; transactions: number; revenue: number }> {
  const [summary, purchaseRevenue, purchaseCompleted] = await Promise.all([
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      metrics: ['sessions'],
      filters,
    }),
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      metrics: ['purchaseRevenue'],
      filters,
    }),
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      metrics: ['eventCount'],
      filters: [...(filters ?? []), { field: 'eventName', operator: 'EXACT', value: '購入完了' }],
    }),
  ])

  return {
    sessions: Number(summary.rows[0]?.sessions ?? 0),
    revenue: Math.round(Number(purchaseRevenue.rows[0]?.purchaseRevenue ?? 0)),
    transactions: Number(purchaseCompleted.rows[0]?.eventCount ?? 0),
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
  date: string,
  magazinePrefix: string
): Promise<Ga4SegmentSummary[]> {
  const magazineFilter: GA4Filter = {
    field: 'landingPage',
    operator: 'CONTAINS',
    value: magazinePrefix,
  }

  const [total, magazine] = await Promise.all([
    fetchSegmentKpi(date),
    fetchSegmentKpi(date, [magazineFilter]),
  ])

  const [sessionsByLp, cvByLp] = await Promise.all([
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      dimensions: ['landingPage'],
      metrics: ['sessions'],
    }),
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      dimensions: ['landingPage'],
      metrics: ['eventCount'],
      filters: [{ field: 'eventName', operator: 'EXACT', value: '購入完了' }],
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
  for (const row of cvByLp.rows) {
    const path = String(row.landingPage ?? '')
    if (!isMagazineLanding(path, magazinePrefix)) {
      nonMagTransactions += Number(row.eventCount ?? 0)
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
  date: string,
  magazinePrefix: string
): Promise<DailySeoReport['landingPages']> {
  const [sessionsByLp, cvByLp] = await Promise.all([
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      dimensions: ['landingPage'],
      metrics: ['sessions'],
    }),
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      dimensions: ['landingPage'],
      metrics: ['eventCount'],
      filters: [{ field: 'eventName', operator: 'EXACT', value: '購入完了' }],
    }),
  ])

  const cvMap = new Map<string, number>()
  for (const row of cvByLp.rows) {
    const path = String(row.landingPage ?? '')
    cvMap.set(path, Number(row.eventCount ?? 0))
  }

  const all: LandingPageMetric[] = sessionsByLp.rows
    .map((row) => {
      const path = String(row.landingPage ?? '')
      const sessions = Number(row.sessions ?? 0)
      const transactions = cvMap.get(path) ?? 0
      return {
        path,
        sessions,
        transactions,
        revenue: 0,
        cvr: calcCvr(sessions, transactions),
      }
    })
    .filter((r) => r.sessions > 0 || r.transactions > 0)

  const magazine = all.filter((r) => isMagazineLanding(r.path, magazinePrefix))

  const sortBySessions = (a: LandingPageMetric, b: LandingPageMetric) => b.sessions - a.sessions
  const sortByCv = (a: LandingPageMetric, b: LandingPageMetric) =>
    b.transactions - a.transactions || b.sessions - a.sessions

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

export async function buildDailySeoReport(): Promise<DailySeoReport> {
  const { targetDate } = getDailySeoDates()
  const yoyCompareDate = getSameWeekdayLastYear(targetDate)
  const siteUrl = process.env.GSC_SITE_URL || 'https://business.mistore.jp/'
  const magazinePrefix = getMagazinePrefix()

  const [topQueries, ga4Segments, landingPages, ga4Previous] = await Promise.all([
    fetchGscTopQueries(targetDate),
    fetchSegmentSummaries(targetDate, magazinePrefix),
    fetchLandingPageMetrics(targetDate, magazinePrefix),
    fetchSegmentKpi(yoyCompareDate),
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
    targetDate,
    yoyCompareDate,
    magazinePrefix,
    gsc: { topQueries },
    ga4,
    ga4Segments,
    landingPages,
  }
}
