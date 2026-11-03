import type { MonthlyTrendPoint } from '@/lib/buildMonthlyTrendSeries'

export type MonthlyTrendMetricId =
  | 'gsc_clicks'
  | 'gsc_impressions'
  | 'gsc_average_ctr'
  | 'gsc_average_position'
  | 'ga4_sessions'
  | 'ga4_users'
  | 'ga4_page_views'
  | 'ga4_transactions'
  | 'ga4_revenue'
  | 'ga4_conversion_rate'

export type MonthlyTrendMetricKind = 'absolute' | 'rate'

export interface MonthlyTrendMetricDef {
  id: MonthlyTrendMetricId
  title: string
  group: 'gsc' | 'ga4'
  kind: MonthlyTrendMetricKind
  invertY?: boolean
  suffix?: string
  getValue: (point: MonthlyTrendPoint) => number
  formatValue: (value: number) => string
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatCompactCurrency(n: number): string {
  if (n >= 1_000_000_000) return `¥${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `¥${(n / 1_000).toFixed(0)}K`
  return `¥${formatNumber(Math.round(n))}`
}

export const MONTHLY_TREND_METRICS: MonthlyTrendMetricDef[] = [
  {
    id: 'gsc_clicks',
    title: 'GSC クリック',
    group: 'gsc',
    kind: 'absolute',
    getValue: (p) => p.gsc.clicks,
    formatValue: formatNumber,
  },
  {
    id: 'gsc_impressions',
    title: 'GSC インプレッション',
    group: 'gsc',
    kind: 'absolute',
    getValue: (p) => p.gsc.impressions,
    formatValue: formatNumber,
  },
  {
    id: 'gsc_average_ctr',
    title: 'GSC 平均CTR',
    group: 'gsc',
    kind: 'rate',
    suffix: '%',
    getValue: (p) => p.gsc.averageCtr,
    formatValue: (v) => `${v.toFixed(2)}%`,
  },
  {
    id: 'gsc_average_position',
    title: 'GSC 平均掲載順位',
    group: 'gsc',
    kind: 'rate',
    invertY: true,
    getValue: (p) => p.gsc.averagePosition,
    formatValue: (v) => v.toFixed(2),
  },
  {
    id: 'ga4_sessions',
    title: 'GA4 セッション',
    group: 'ga4',
    kind: 'absolute',
    getValue: (p) => p.ga4.sessions,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_users',
    title: 'GA4 ユーザー',
    group: 'ga4',
    kind: 'absolute',
    getValue: (p) => p.ga4.users,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_page_views',
    title: 'GA4 PV',
    group: 'ga4',
    kind: 'absolute',
    getValue: (p) => p.ga4.pageViews,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_transactions',
    title: 'GA4 購入完了',
    group: 'ga4',
    kind: 'absolute',
    getValue: (p) => p.ga4.transactions,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_revenue',
    title: 'GA4 売上',
    group: 'ga4',
    kind: 'absolute',
    suffix: '円',
    getValue: (p) => p.ga4.revenue,
    formatValue: formatCompactCurrency,
  },
  {
    id: 'ga4_conversion_rate',
    title: 'GA4 CVR',
    group: 'ga4',
    kind: 'rate',
    suffix: '%',
    getValue: (p) => p.ga4.conversionRate,
    formatValue: (v) => `${v.toFixed(2)}%`,
  },
]
