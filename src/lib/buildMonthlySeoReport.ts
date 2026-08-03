import {
  buildComprehensiveReport,
  type ComprehensiveReportResponse,
} from '@/lib/buildComprehensiveReport'
import { getMonthlySeoPeriod } from '@/lib/dateUtils'
import {
  findDeclinedQueries,
  findGrowingQueries,
  topCurrentWithYoYForQueries,
  type DeclinedRow,
  type GrowthRow,
  type QueryYoYRow,
} from '@/lib/gscDimensionYoY'
import { summarizeQueryPortfolioBySeason, type PortfolioSeasonSummary } from '@/lib/querySeason'

export interface MonthlySeoReport {
  siteUrl: string
  monthStart: string
  monthEnd: string
  monthKey: string
  yoyMonthStart: string
  yoyMonthEnd: string
  magazinePrefix: string
  comprehensive: ComprehensiveReportResponse
  topQueriesYoY: QueryYoYRow[]
  growingQueries: GrowthRow[]
  declinedQueries: DeclinedRow[]
  queryPortfolio: PortfolioSeasonSummary
}

function getMagazinePrefix(): string {
  return (
    process.env.SEO_MONTHLY_MAGAZINE_PREFIX ??
    process.env.SEO_WEEKLY_MAGAZINE_PREFIX ??
    process.env.SEO_DAILY_MAGAZINE_PREFIX ??
    '/magazine/'
  )
}

export async function buildMonthlySeoReport(): Promise<MonthlySeoReport> {
  const { monthStart, monthEnd, monthKey, yoyMonthStart, yoyMonthEnd } = getMonthlySeoPeriod()
  const magazinePrefix = getMagazinePrefix()
  const siteUrl = process.env.GSC_SITE_URL || 'https://business.mistore.jp/'

  const comprehensive = await buildComprehensiveReport({
    startDate: monthStart,
    endDate: monthEnd,
    magazinePathPrefix: magazinePrefix,
  })

  const currentQueries = comprehensive.siteWide.current.gsc.allQueries ?? []
  const yearAgoQueries = comprehensive.siteWide.yearAgo.gsc.allQueries ?? []
  const sortedQueries = [...currentQueries].sort((a, b) => b.clicks - a.clicks)

  const topQueriesYoY = topCurrentWithYoYForQueries(sortedQueries, yearAgoQueries, 10)
  const growingQueries = findGrowingQueries(currentQueries, yearAgoQueries, {
    minYearAgoClicks: 30,
    minGain: 1,
    limit: 5,
  })
  const declinedQueries = findDeclinedQueries(currentQueries, yearAgoQueries, {
    minYearAgoClicks: 50,
    limit: 5,
  })
  const queryPortfolio = summarizeQueryPortfolioBySeason(currentQueries)

  return {
    siteUrl,
    monthStart,
    monthEnd,
    monthKey,
    yoyMonthStart,
    yoyMonthEnd,
    magazinePrefix,
    comprehensive,
    topQueriesYoY,
    growingQueries,
    declinedQueries,
    queryPortfolio,
  }
}
