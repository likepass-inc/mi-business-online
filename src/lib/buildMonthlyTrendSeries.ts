import { fetchSiteKpiSummary } from '@/lib/buildSiteReport'
import { getMonthlyCalendarPeriods } from '@/lib/dateUtils'

export interface MonthlyTrendPoint {
  monthKey: string
  label: string
  gsc: {
    clicks: number
    impressions: number
    averageCtr: number
    averagePosition: number
  }
  ga4: {
    sessions: number
    users: number
    pageViews: number
    transactions: number
    revenue: number
    conversionRate: number
  }
}

export type MonthlyTrendSeries = MonthlyTrendPoint[]

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

function toTrendLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}/${month}`
}

export async function buildMonthlyTrendSeries(endMonthKey: string): Promise<MonthlyTrendSeries> {
  const periods = getMonthlyCalendarPeriods(endMonthKey, 13)

  const points = await runInBatches(periods, 3, async (period) => {
    const summary = await fetchSiteKpiSummary(period.monthStart, period.monthEnd)
    return {
      monthKey: period.monthKey,
      label: toTrendLabel(period.monthKey),
      gsc: {
        clicks: summary.gsc.totalClicks,
        impressions: summary.gsc.totalImpressions,
        averageCtr: summary.gsc.averageCtr,
        averagePosition: summary.gsc.averagePosition,
      },
      ga4: {
        sessions: summary.ga4.sessions,
        users: summary.ga4.users,
        pageViews: summary.ga4.pageViews,
        transactions: summary.ga4.transactions,
        revenue: summary.ga4.revenue,
        conversionRate: summary.ga4.conversionRate,
      },
    }
  })

  return points
}
