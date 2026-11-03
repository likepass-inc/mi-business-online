import type { MonthlyTrendSeries } from '@/lib/buildMonthlyTrendSeries'

export interface MonthlyYoyKpi {
  id: string
  label: string
  current: number
  previous: number
  percentChange: number | null
  format: 'number' | 'percent' | 'currency'
}

export interface MonthlyFunnelStep {
  id: string
  label: string
  value: number
  /** 直前ステップからの継続率（先頭は 100） */
  continueRate: number
  dropoffRate: number
}

export interface MonthlyFunnelSnapshot {
  steps: MonthlyFunnelStep[]
  overallConversionRate: number
}

export interface SiteSearchQueryRow {
  query_text: string
  cnt: number
}

export interface SiteSearchEffectSnapshot {
  startYmd: string
  endYmd: string
  label: string
  totalSearches: number
  uniqueQueries: number
  avgKnowledge: number
  avgProducts: number
  topQueries: SiteSearchQueryRow[]
  zeroHitQueries: SiteSearchQueryRow[]
  ga4: {
    events?: {
      open?: { eventCount?: number; totalUsers?: number }
      submit?: { eventCount?: number; totalUsers?: number }
      resultClick?: { eventCount?: number; totalUsers?: number }
      productClick?: { eventCount?: number; totalUsers?: number } | null
    }
    contribution?: {
      contributionAvailable?: boolean
      cvSharePercent?: number | null
      totalUserPurchaseRate?: number | null
      searchUserPurchaseRate?: number | null
      total?: {
        sessions?: number
        purchaseRevenue?: number
        ecommercePurchases?: number
        activeUsers?: number
      }
      searchUsers?: {
        sessions?: number
        purchaseRevenue?: number
        ecommercePurchases?: number
        activeUsers?: number
      }
      attributionWindowDays?: number
    }
    daily?: Array<{
      date: string
      searches?: number
      searchRevenue?: number
    }>
  } | null
}

export interface MonthlyChartsPayload {
  monthKey: string
  yoyMonthKey: string
  yoyKpis: MonthlyYoyKpi[]
  trends: MonthlyTrendSeries
  funnel: {
    current: MonthlyFunnelSnapshot
    yearAgo: MonthlyFunnelSnapshot
  }
  aiSearch: {
    current: SiteSearchEffectSnapshot
    yearAgo: SiteSearchEffectSnapshot
  } | null
}
