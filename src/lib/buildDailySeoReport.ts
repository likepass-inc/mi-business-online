import { fetchGA4Data } from '@/lib/ga4Client'
import { fetchGSCData } from '@/lib/gscClient'
import { getDailySeoDates } from '@/lib/dateUtils'

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
  gsc: {
    topQueries: GscQueryRanking[]
  }
  ga4: {
    sessions: number
    transactions: number
    revenue: number
  }
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

async function fetchGa4DayMetrics(date: string): Promise<DailySeoReport['ga4']> {
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
  const siteUrl = process.env.GSC_SITE_URL || 'https://business.mistore.jp/'

  const [topQueries, ga4] = await Promise.all([
    fetchGscTopQueries(targetDate),
    fetchGa4DayMetrics(targetDate),
  ])

  return {
    siteUrl,
    targetDate,
    gsc: { topQueries },
    ga4,
  }
}
