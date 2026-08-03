import type { MonthlySeoReport } from '@/lib/buildMonthlySeoReport'
import type { NumericDelta } from '@/lib/buildComprehensiveReport'
import {
  insightQueryPortfolio,
  insightSiteGscSummary,
  insightMagazineGsc,
  insightMagazineGa4,
  insightGa4Summary,
} from '@/lib/comprehensiveReportInsights'
import type { SlackMessagePayload } from '@/lib/slackClient'
import type { DeclinedRow, GrowthRow, QueryYoYRow } from '@/lib/gscDimensionYoY'
import {
  MONTHLY_TREND_METRICS,
  type MonthlyTrendMetricId,
} from '@/lib/monthlyTrendCharts'

function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP')
}

function formatPct(p: number | null | undefined): string {
  if (p === null || p === undefined || !isFinite(p)) return '—'
  const sign = p >= 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}

function formatDeltaLine(label: string, d: NumericDelta, options?: { suffix?: string }): string {
  const suf = options?.suffix ?? ''
  const pct = formatPct(d.percentChange)
  const abs = `${d.absoluteChange >= 0 ? '+' : ''}${formatNumber(d.absoluteChange)}${suf}`
  return `${label}: *${formatNumber(d.current)}*（前年 ${formatNumber(d.previous)} / ${abs} / ${pct}）`
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}年${parseInt(month, 10)}月`
}

function formatMonthRange(report: MonthlySeoReport): string {
  return `${formatMonthLabel(report.monthKey)}（${report.monthStart}〜${report.monthEnd}）`
}

function stripInsightMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '*')
    .replace(/^> /gm, '')
    .replace(/\n\*\*考察[^*]*\*\*\n\n/g, '\n')
    .trim()
}

function toPayload(text: string): SlackMessagePayload {
  return {
    text,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text },
      },
    ],
  }
}

function buildHeaderText(report: MonthlySeoReport): string {
  return `:bar_chart: Monthly KPI Bot — ${formatMonthRange(report)}`
}

function buildSiteSummaryThreadText(report: MonthlySeoReport): string {
  const y = report.comprehensive.siteWide.yearOverYear
  const yoyRange = `${report.yoyMonthStart}〜${report.yoyMonthEnd}`
  const gscInsight = stripInsightMarkdown(insightSiteGscSummary(y.gsc))
  const ga4Insight = stripInsightMarkdown(insightGa4Summary(y.ga4))

  const lines = [
    `*サイト全体 — 前年同月比*（${formatMonthRange(report)} vs ${yoyRange}）`,
    '',
    '*Google Search Console*',
    formatDeltaLine('クリック', y.gsc.totalClicks),
    formatDeltaLine('インプレッション', y.gsc.totalImpressions),
    formatDeltaLine('平均CTR', y.gsc.averageCtr, { suffix: '%' }),
    formatDeltaLine('平均掲載順位', y.gsc.averagePosition),
    '',
    '*GA4*',
    formatDeltaLine('セッション', y.ga4.sessions),
    formatDeltaLine('ユーザー', y.ga4.users),
    formatDeltaLine('PV', y.ga4.pageViews),
    formatDeltaLine('購入完了', y.ga4.transactions),
    formatDeltaLine('売上', y.ga4.revenue, { suffix: '円' }),
    formatDeltaLine('CVR', y.ga4.conversionRate, { suffix: '%' }),
  ]

  if (gscInsight) lines.push('', `_考察: ${gscInsight}_`)
  if (ga4Insight) lines.push('', `_考察: ${ga4Insight}_`)

  return lines.join('\n')
}

function buildMagazineSummaryThreadText(report: MonthlySeoReport): string {
  const my = report.comprehensive.magazine.yearOverYear
  const sy = report.comprehensive.siteWide.yearOverYear
  const gscInsight = stripInsightMarkdown(insightMagazineGsc(my.gsc, sy.gsc))
  const ga4Insight = stripInsightMarkdown(insightMagazineGa4(my.ga4))

  const lines = [
    `*マガジン（${report.magazinePrefix}）— 前年同月比*`,
    '',
    '*Google Search Console*',
    formatDeltaLine('クリック', my.gsc.totalClicks),
    formatDeltaLine('インプレッション', my.gsc.totalImpressions),
    formatDeltaLine('平均CTR', my.gsc.averageCtr, { suffix: '%' }),
    formatDeltaLine('平均掲載順位', my.gsc.averagePosition),
    '',
    '*GA4（pagePath contains）*',
    formatDeltaLine('セッション', my.ga4.sessions),
    formatDeltaLine('ユーザー', my.ga4.users),
    formatDeltaLine('PV', my.ga4.pageViews),
  ]

  if (gscInsight) lines.push('', `_考察: ${gscInsight}_`)
  if (ga4Insight) lines.push('', `_考察: ${ga4Insight}_`)

  return lines.join('\n')
}

function formatQueryYoYLine(rank: number, row: QueryYoYRow): string {
  const query = row.query || '(不明)'
  return `${rank}. ${query} — クリック *${formatNumber(row.currentClicks)}*（前年 ${formatNumber(row.yearAgoClicks)} / ${row.delta >= 0 ? '+' : ''}${formatNumber(row.delta)} / ${formatPct(row.pctChange)}）`
}

function formatGrowingLine(rank: number, row: GrowthRow): string {
  return `${rank}. ${row.key} — +${formatNumber(row.clickGain)}（現在 ${formatNumber(row.currentClicks)} / 前年 ${formatNumber(row.yearAgoClicks)} / ${formatPct(row.pctChange)}）`
}

function formatDeclinedLine(rank: number, row: DeclinedRow): string {
  return `${rank}. ${row.key} — -${formatNumber(row.clickDrop)}（前年 ${formatNumber(row.yearAgoClicks)} → 現在 ${formatNumber(row.currentClicks)} / ${formatPct(row.pctChange)}）`
}

function buildQueryHighlightsThreadText(report: MonthlySeoReport): string {
  const topLines =
    report.topQueriesYoY.length > 0
      ? report.topQueriesYoY.map((q, i) => formatQueryYoYLine(i + 1, q))
      : ['データなし']
  const growingLines =
    report.growingQueries.length > 0
      ? report.growingQueries.map((q, i) => formatGrowingLine(i + 1, q))
      : ['データなし']
  const declinedLines =
    report.declinedQueries.length > 0
      ? report.declinedQueries.map((q, i) => formatDeclinedLine(i + 1, q))
      : ['データなし']

  return [
    `*GSC クエリハイライト（${formatMonthRange(report)}）*`,
    '',
    '*クリック TOP10 × 前年同月*',
    ...topLines,
    '',
    '*前年同月比で伸長 TOP5*',
    ...growingLines,
    '',
    '*前年に強かったが減少 TOP5*',
    ...declinedLines,
  ].join('\n')
}

function buildChannelDeviceThreadText(report: MonthlySeoReport): string {
  const ga4 = report.comprehensive.siteWide.current.ga4
  const channelLines = ga4.byChannel.slice(0, 5).map((c, i) => {
    return `${i + 1}. ${c.channel} — セッション *${formatNumber(c.sessions)}* / CV *${formatNumber(c.transactions)}* / 売上 *¥${formatNumber(c.revenue)}*`
  })
  const deviceLines = ga4.byDevice.slice(0, 3).map((d, i) => {
    return `${i + 1}. ${d.device} — セッション *${formatNumber(d.sessions)}* / CV *${formatNumber(d.transactions)}* / 売上 *¥${formatNumber(d.revenue)}*`
  })

  return [
    `*GA4 チャネル・デバイス（${formatMonthRange(report)}）*`,
    '',
    '*チャネル TOP5（セッション順）*',
    ...(channelLines.length > 0 ? channelLines : ['データなし']),
    '',
    '*デバイス*',
    ...(deviceLines.length > 0 ? deviceLines : ['データなし']),
  ].join('\n')
}

function buildPortfolioThreadText(report: MonthlySeoReport): string {
  const port = report.queryPortfolio
  const totalClicks = port.seasonalClicks + port.evergreenClicks
  const totalImp = port.seasonalImpressions + port.evergreenImpressions
  const evergreenClickShare = totalClicks ? ((port.evergreenClicks / totalClicks) * 100).toFixed(1) : '0.0'
  const seasonalClickShare = totalClicks ? ((port.seasonalClicks / totalClicks) * 100).toFixed(1) : '0.0'
  const portfolioInsight = stripInsightMarkdown(insightQueryPortfolio(port, 'site'))

  const lines = [
    `*クエリポートフォリオ（${formatMonthRange(report)}）*`,
    '',
    '```',
    '区分           クリック    シェア   インプレッション  シェア',
    `季節語ヒット   ${formatNumber(port.seasonalClicks).padStart(8)}  ${seasonalClickShare.padStart(5)}%  ${formatNumber(port.seasonalImpressions).padStart(12)}  ${totalImp ? ((port.seasonalImpressions / totalImp) * 100).toFixed(1).padStart(5) : '  0.0'}%`,
    `通年寄り       ${formatNumber(port.evergreenClicks).padStart(8)}  ${evergreenClickShare.padStart(5)}%  ${formatNumber(port.evergreenImpressions).padStart(12)}  ${totalImp ? ((port.evergreenImpressions / totalImp) * 100).toFixed(1).padStart(5) : '  0.0'}%`,
    '```',
    '',
    '_季節語は querySeason.ts のルールベース分類_',
  ]

  if (portfolioInsight) {
    lines.push('', `_考察: ${portfolioInsight}_`)
  }

  return lines.join('\n')
}

export function formatSeoMonthlyParentMessage(report: MonthlySeoReport): SlackMessagePayload {
  return toPayload(buildHeaderText(report))
}

/** グラフのみ投稿時の親メッセージ */
export function formatSeoMonthlyChartsParentMessage(report: MonthlySeoReport): SlackMessagePayload {
  return toPayload(
    `:chart_with_upwards_trend: Monthly KPI Bot — ${formatMonthLabel(report.monthKey)} 13ヶ月推移グラフ`
  )
}

export function formatSeoMonthlyThreadMessages(report: MonthlySeoReport): SlackMessagePayload[] {
  return [
    toPayload(buildSiteSummaryThreadText(report)),
    toPayload(buildMagazineSummaryThreadText(report)),
    toPayload(buildQueryHighlightsThreadText(report)),
    toPayload(buildChannelDeviceThreadText(report)),
    toPayload(buildPortfolioThreadText(report)),
  ]
}

export function formatSeoMonthlyMessage(report: MonthlySeoReport): SlackMessagePayload {
  const parts = [
    buildHeaderText(report),
    buildSiteSummaryThreadText(report),
    buildMagazineSummaryThreadText(report),
    buildQueryHighlightsThreadText(report),
    buildChannelDeviceThreadText(report),
    buildPortfolioThreadText(report),
  ]
  return toPayload(parts.join('\n\n---\n\n'))
}

const METRIC_YOY_MAP: Record<
  MonthlyTrendMetricId,
  { getDelta: (report: MonthlySeoReport) => NumericDelta; suffix?: string }
> = {
  gsc_clicks: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.gsc.totalClicks,
  },
  gsc_impressions: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.gsc.totalImpressions,
  },
  gsc_average_ctr: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.gsc.averageCtr,
    suffix: '%',
  },
  gsc_average_position: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.gsc.averagePosition,
  },
  ga4_sessions: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.ga4.sessions,
  },
  ga4_users: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.ga4.users,
  },
  ga4_page_views: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.ga4.pageViews,
  },
  ga4_transactions: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.ga4.transactions,
  },
  ga4_revenue: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.ga4.revenue,
    suffix: '円',
  },
  ga4_conversion_rate: {
    getDelta: (r) => r.comprehensive.siteWide.yearOverYear.ga4.conversionRate,
    suffix: '%',
  },
}

function formatCaptionDeltaLine(label: string, d: NumericDelta, options?: { suffix?: string }): string {
  const suf = options?.suffix ?? ''
  const pct = formatPct(d.percentChange)
  const abs = `${d.absoluteChange >= 0 ? '+' : ''}${formatNumber(d.absoluteChange)}${suf}`
  return `${label}: *${formatNumber(d.current)}${suf}*（前年 ${formatNumber(d.previous)}${suf} / ${abs} / ${pct}）`
}

/** グラフ投稿用キャプション（指標名 + 当月前年同月比） */
export function getMonthlyTrendChartCaptions(report: MonthlySeoReport): Array<{
  metricId: MonthlyTrendMetricId
  caption: string
  filename: string
}> {
  return MONTHLY_TREND_METRICS.map((metric) => {
    const yoy = METRIC_YOY_MAP[metric.id]
    const delta = yoy.getDelta(report)
    const caption = formatCaptionDeltaLine(metric.title, delta, { suffix: yoy.suffix ?? metric.suffix })
    return {
      metricId: metric.id,
      caption,
      filename: `monthly-trend-${metric.id}.png`,
    }
  })
}

export function getMonthlyTrendChartCount(): number {
  return MONTHLY_TREND_METRICS.length
}
