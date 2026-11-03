import type { ComprehensiveReportResponse, NumericDelta } from '@/lib/buildComprehensiveReport'
import type { MonthlyTrendSeries } from '@/lib/buildMonthlyTrendSeries'
import type { MonthlyChartsPayload, MonthlyYoyKpi } from '@/lib/monthlyChartsTypes'
import type { MonthlyFunnelSnapshot } from '@/lib/monthlyChartsTypes'
import type { SiteSearchEffectSnapshot } from '@/lib/monthlyChartsTypes'

function kpi(
  id: string,
  label: string,
  delta: NumericDelta,
  format: MonthlyYoyKpi['format']
): MonthlyYoyKpi {
  return {
    id,
    label,
    current: delta.current,
    previous: delta.previous,
    percentChange: delta.percentChange,
    format,
  }
}

export function buildYoyKpisFromComprehensive(
  report: ComprehensiveReportResponse
): MonthlyYoyKpi[] {
  const y = report.siteWide.yearOverYear
  return [
    kpi('gsc_clicks', 'GSC クリック', y.gsc.totalClicks, 'number'),
    kpi('gsc_impressions', 'GSC インプレッション', y.gsc.totalImpressions, 'number'),
    kpi('sessions', 'セッション', y.ga4.sessions, 'number'),
    kpi('transactions', '購入完了', y.ga4.transactions, 'number'),
    kpi('revenue', '売上', y.ga4.revenue, 'currency'),
    kpi('cvr', 'CVR', y.ga4.conversionRate, 'percent'),
  ]
}

export function buildMonthlyChartsPayload(input: {
  monthKey: string
  yoyMonthKey: string
  comprehensive: ComprehensiveReportResponse
  trends: MonthlyTrendSeries
  funnel: { current: MonthlyFunnelSnapshot; yearAgo: MonthlyFunnelSnapshot }
  aiSearch: {
    current: SiteSearchEffectSnapshot
    yearAgo: SiteSearchEffectSnapshot
  } | null
}): MonthlyChartsPayload {
  return {
    monthKey: input.monthKey,
    yoyMonthKey: input.yoyMonthKey,
    yoyKpis: buildYoyKpisFromComprehensive(input.comprehensive),
    trends: input.trends,
    funnel: input.funnel,
    aiSearch: input.aiSearch,
  }
}
