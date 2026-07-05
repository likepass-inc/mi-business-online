import { fetchGA4Data } from '@/lib/ga4Client'
import { fetchGSCData } from '@/lib/gscClient'
import { getDailySeoDates, getSameWeekdayLastYear } from '@/lib/dateUtils'

export interface GscQueryRanking {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface DailySeoReport {
  siteUrl: string
  targetDate: string
  yoyCompareDate: string
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
}

interface Ga4DayMetrics {
  sessions: number
  transactions: number
  revenue: number
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

async function fetchGa4DayMetrics(date: string): Promise<Ga4DayMetrics> {
  const [summary, purchaseRevenue, purchaseCompleted] = await Promise.all([
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      metrics: ['sessions'],
    }),
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      metrics: ['purchaseRevenue'],
    }),
    fetchGA4Data({
      dateRange: { startDate: date, endDate: date },
      metrics: ['eventCount'],
      filters: [{ field: 'eventName', operator: 'EXACT', value: '購入完了' }],
    }),
  ])

  const sessions = Number(summary.rows[0]?.sessions ?? 0)
  const revenue = Math.round(Number(purchaseRevenue.rows[0]?.purchaseRevenue ?? 0))
  const transactions = Number(purchaseCompleted.rows[0]?.eventCount ?? 0)

  return { sessions, transactions, revenue }
}

export async function buildDailySeoReport(): Promise<DailySeoReport> {
  const { targetDate } = getDailySeoDates()
  const yoyCompareDate = getSameWeekdayLastYear(targetDate)
  const siteUrl = process.env.GSC_SITE_URL || 'https://business.mistore.jp/'

  const [topQueries, ga4Current, ga4Previous] = await Promise.all([
    fetchGscTopQueries(targetDate),
    fetchGa4DayMetrics(targetDate),
    fetchGa4DayMetrics(yoyCompareDate),
  ])

  return {
    siteUrl,
    targetDate,
    yoyCompareDate,
    gsc: { topQueries },
    ga4: {
      ...ga4Current,
      yoyPercent: {
        sessions: calculateYoYPercent(ga4Current.sessions, ga4Previous.sessions),
        transactions: calculateYoYPercent(ga4Current.transactions, ga4Previous.transactions),
        revenue: calculateYoYPercent(ga4Current.revenue, ga4Previous.revenue),
      },
    },
  }
}
