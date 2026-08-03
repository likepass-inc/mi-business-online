import { buildMagazineReport, type MagazineReportResponse } from '@/lib/buildMagazineReport'
import { buildSiteReport, type SiteReportResponse } from '@/lib/buildSiteReport'
import { getDateRangeDaysEndingWithOffset, getYearOverYearPeriod } from '@/lib/dateUtils'

export interface NumericDelta {
  current: number
  previous: number
  absoluteChange: number
  percentChange: number | null
}

export function computeDelta(current: number, previous: number): NumericDelta {
  const absoluteChange = current - previous
  const percentChange = previous !== 0 ? (absoluteChange / previous) * 100 : null
  return { current, previous, absoluteChange, percentChange }
}

export interface SiteWideYearOverYear {
  gsc: {
    totalClicks: NumericDelta
    totalImpressions: NumericDelta
    averageCtr: NumericDelta
    averagePosition: NumericDelta
  }
  ga4: {
    sessions: NumericDelta
    users: NumericDelta
    pageViews: NumericDelta
    transactions: NumericDelta
    revenue: NumericDelta
    conversionRate: NumericDelta
  }
}

export interface MagazineYearOverYear {
  gsc: {
    totalClicks: NumericDelta
    totalImpressions: NumericDelta
    averageCtr: NumericDelta
    averagePosition: NumericDelta
  }
  ga4: {
    sessions: NumericDelta
    users: NumericDelta
    pageViews: NumericDelta
  }
}

export interface ComprehensiveReportResponse {
  meta: {
    days: number
    endOffsetDays: number
    magazinePathPrefix: string
    currentPeriod: { startDate: string; endDate: string }
    yearAgoPeriod: { startDate: string; endDate: string }
    notes: string[]
  }
  siteWide: {
    current: SiteReportResponse
    yearAgo: SiteReportResponse
    yearOverYear: SiteWideYearOverYear
  }
  magazine: {
    current: MagazineReportResponse
    yearAgo: MagazineReportResponse
    yearOverYear: MagazineYearOverYear
  }
}

function buildSiteWideYoY(
  current: SiteReportResponse,
  yearAgo: SiteReportResponse
): SiteWideYearOverYear {
  const g = current.gsc.summary
  const gp = yearAgo.gsc.summary
  const a = current.ga4.summary
  const ap = yearAgo.ga4.summary
  return {
    gsc: {
      totalClicks: computeDelta(g.totalClicks, gp.totalClicks),
      totalImpressions: computeDelta(g.totalImpressions, gp.totalImpressions),
      averageCtr: computeDelta(g.averageCtr, gp.averageCtr),
      averagePosition: computeDelta(g.averagePosition, gp.averagePosition),
    },
    ga4: {
      sessions: computeDelta(a.sessions, ap.sessions),
      users: computeDelta(a.users, ap.users),
      pageViews: computeDelta(a.pageViews, ap.pageViews),
      transactions: computeDelta(a.transactions, ap.transactions),
      revenue: computeDelta(a.revenue, ap.revenue),
      conversionRate: computeDelta(a.conversionRate, ap.conversionRate),
    },
  }
}

function buildMagazineYoY(
  current: MagazineReportResponse,
  yearAgo: MagazineReportResponse
): MagazineYearOverYear {
  const g = current.gsc.summary
  const gp = yearAgo.gsc.summary
  const a = current.ga4.summary
  const ap = yearAgo.ga4.summary
  return {
    gsc: {
      totalClicks: computeDelta(g.totalClicks, gp.totalClicks),
      totalImpressions: computeDelta(g.totalImpressions, gp.totalImpressions),
      averageCtr: computeDelta(g.averageCtr, gp.averageCtr),
      averagePosition: computeDelta(g.averagePosition, gp.averagePosition),
    },
    ga4: {
      sessions: computeDelta(a.sessions, ap.sessions),
      users: computeDelta(a.users, ap.users),
      pageViews: computeDelta(a.pageViews, ap.pageViews),
    },
  }
}

export interface BuildComprehensiveOptions {
  days?: number
  /** 終端日を今日から何日前にするか（デフォルト 1 = 昨日まで） */
  endOffsetDays?: number
  /** 明示的な集計期間（指定時は days / endOffsetDays を無視） */
  startDate?: string
  endDate?: string
  magazinePathPrefix?: string
}

function countDaysInclusive(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00Z`)
  const end = new Date(`${endDate}T12:00:00Z`)
  const diffMs = end.getTime() - start.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
}

export async function buildComprehensiveReport(
  options?: BuildComprehensiveOptions
): Promise<ComprehensiveReportResponse> {
  const magazinePathPrefix = options?.magazinePathPrefix ?? '/magazine/'

  let currentPeriod: { startDate: string; endDate: string }
  let days: number
  let endOffsetDays: number

  if (options?.startDate && options?.endDate) {
    currentPeriod = { startDate: options.startDate, endDate: options.endDate }
    days = countDaysInclusive(currentPeriod.startDate, currentPeriod.endDate)
    endOffsetDays = 0
  } else {
    days = options?.days ?? 30
    endOffsetDays = options?.endOffsetDays ?? 1
    currentPeriod = getDateRangeDaysEndingWithOffset(days, { endOffsetDays })
  }

  const yearAgoPeriod = getYearOverYearPeriod(
    currentPeriod.startDate,
    currentPeriod.endDate
  )

  const [siteCurrent, siteYearAgo, magCurrent, magYearAgo] = await Promise.all([
    buildSiteReport(currentPeriod.startDate, currentPeriod.endDate),
    buildSiteReport(yearAgoPeriod.startDate, yearAgoPeriod.endDate),
    buildMagazineReport(
      currentPeriod.startDate,
      currentPeriod.endDate,
      magazinePathPrefix
    ),
    buildMagazineReport(
      yearAgoPeriod.startDate,
      yearAgoPeriod.endDate,
      magazinePathPrefix
    ),
  ])

  return {
    meta: {
      days,
      endOffsetDays,
      magazinePathPrefix,
      currentPeriod,
      yearAgoPeriod,
      notes: [
        'Google Search Console のデータは最大で数日遅れて反映されることがあります。',
        'マガジン配下の厳密な購入帰属には、GA4 の探索や BigQuery 連携が有効な場合があります（本レポートのマガジン GA4 は pagePath に基づくトラフィック指標です）。',
      ],
    },
    siteWide: {
      current: siteCurrent,
      yearAgo: siteYearAgo,
      yearOverYear: buildSiteWideYoY(siteCurrent, siteYearAgo),
    },
    magazine: {
      current: magCurrent,
      yearAgo: magYearAgo,
      yearOverYear: buildMagazineYoY(magCurrent, magYearAgo),
    },
  }
}
