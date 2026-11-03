import type { ComprehensiveReportResponse, NumericDelta } from '@/lib/buildComprehensiveReport'
import type { MonthlyTrendSeries } from '@/lib/buildMonthlyTrendSeries'
import {
  insightChannels,
  insightDeclinedPages,
  insightDeclinedQueries,
  insightDevices,
  insightGa4Summary,
  insightGrowingPages,
  insightGrowingQueries,
  insightMagazineGa4,
  insightMagazineGsc,
  insightQueryPortfolio,
  insightSiteGscSummary,
  insightTopPages,
  insightTopQueries,
} from '@/lib/comprehensiveReportInsights'
import { getCalendarMonthPeriod } from '@/lib/dateUtils'
import {
  findDeclinedPages,
  findDeclinedQueries,
  findGrowingPages,
  findGrowingQueries,
  mdEscapeCell,
  topCurrentWithYoYForPages,
  topCurrentWithYoYForQueries,
} from '@/lib/gscDimensionYoY'
import { summarizeQueryPortfolioBySeason } from '@/lib/querySeason'

function formatDelta(d: NumericDelta, options?: { lowerIsBetter?: boolean; suffix?: string }): string {
  const suf = options?.suffix ?? ''
  const lower = options?.lowerIsBetter ?? false
  if (d.previous === 0 && d.current === 0) return '—'
  const pct = d.percentChange !== null ? `${d.percentChange >= 0 ? '+' : ''}${d.percentChange.toFixed(1)}%` : '—'
  const abs = `${d.absoluteChange >= 0 ? '+' : ''}${d.absoluteChange.toLocaleString()}${suf}`
  const good =
    d.percentChange === null
      ? ''
      : lower
        ? d.percentChange < 0
          ? '（好調）'
          : d.percentChange > 0
            ? '（注意）'
            : ''
        : d.percentChange > 0
          ? '（好調）'
          : d.percentChange < 0
            ? '（注意）'
            : ''
  return `${abs} / ${pct}${good}`
}

function formatPct(p: number | null): string {
  if (p === null) return '—'
  const sign = p >= 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}

function calendarMonthLabel(startDate: string, endDate: string): string | null {
  if (!/^\d{4}-\d{2}-01$/.test(startDate)) return null
  const monthKey = startDate.slice(0, 7)
  try {
    const period = getCalendarMonthPeriod(monthKey)
    if (period.monthEnd !== endDate) return null
    const [year, month] = monthKey.split('-')
    return `${year}年${parseInt(month, 10)}月`
  } catch {
    return null
  }
}

function renderExecSummary(report: ComprehensiveReportResponse): string {
  const y = report.siteWide.yearOverYear
  let md = `## エグゼクティブサマリー\n\n`
  md += `| 指標 | 現在 | 前年同期 | 変化 |\n`
  md += `|------|------|----------|------|\n`
  md += `| GSC クリック | ${y.gsc.totalClicks.current.toLocaleString()} | ${y.gsc.totalClicks.previous.toLocaleString()} | ${formatDelta(y.gsc.totalClicks)} |\n`
  md += `| GSC インプレッション | ${y.gsc.totalImpressions.current.toLocaleString()} | ${y.gsc.totalImpressions.previous.toLocaleString()} | ${formatDelta(y.gsc.totalImpressions)} |\n`
  md += `| セッション | ${y.ga4.sessions.current.toLocaleString()} | ${y.ga4.sessions.previous.toLocaleString()} | ${formatDelta(y.ga4.sessions)} |\n`
  md += `| 購入完了 | ${y.ga4.transactions.current.toLocaleString()} | ${y.ga4.transactions.previous.toLocaleString()} | ${formatDelta(y.ga4.transactions)} |\n`
  md += `| 売上 | ¥${y.ga4.revenue.current.toLocaleString()} | ¥${y.ga4.revenue.previous.toLocaleString()} | ${formatDelta(y.ga4.revenue, { suffix: '円' })} |\n`
  md += `| CVR | ${y.ga4.conversionRate.current.toFixed(2)}% | ${y.ga4.conversionRate.previous.toFixed(2)}% | ${formatDelta(y.ga4.conversionRate, { suffix: '%' })} |\n`
  md += `\n---\n\n`
  return md
}

export function renderMonthlyTrendMarkdown(series: MonthlyTrendSeries): string {
  let md = `## 直近13ヶ月の推移\n\n`
  md += `| 月 | GSCクリック | セッション | 購入完了 | 売上 |\n`
  md += `|----|-------------|-----------|----------|------|\n`
  for (const point of series) {
    md += `| ${point.label} | ${point.gsc.clicks.toLocaleString()} | ${point.ga4.sessions.toLocaleString()} | ${point.ga4.transactions.toLocaleString()} | ¥${point.ga4.revenue.toLocaleString()} |\n`
  }
  md += `\n`
  return md
}

export interface RenderComprehensiveMarkdownOptions {
  includeExecSummary?: boolean
  monthlyTrend?: MonthlyTrendSeries
}

export function renderComprehensiveMarkdown(
  report: ComprehensiveReportResponse,
  options?: RenderComprehensiveMarkdownOptions
): string {
  const { meta, siteWide, magazine } = report
  const cur = meta.currentPeriod
  const yoy = meta.yearAgoPeriod
  const y = siteWide.yearOverYear
  const monthLabel = calendarMonthLabel(cur.startDate, cur.endDate)
  const title = monthLabel
    ? `${monthLabel} サイト集客・売上レポート`
    : `GSC・GA4 包括レポート（直近${meta.days}日・前年同期比）`

  let md = `# ${title}\n\n`
  md += `**対象期間（現在）**: ${cur.startDate} 〜 ${cur.endDate}\n\n`
  md += `**前年同期**: ${yoy.startDate} 〜 ${yoy.endDate}\n\n`
  md += `**マガジンパス**: \`${meta.magazinePathPrefix}\`（GSC: page contains / GA4: pagePath contains）\n\n`
  if (meta.endOffsetDays > 0) {
    md += `**終端オフセット**: 終了日は今日から ${meta.endOffsetDays} 日前（GSC の反映遅延を考慮）\n\n`
  }
  md += `**生成日時**: ${new Date().toLocaleString('ja-JP')}\n\n`
  md += `### 注記\n\n`
  meta.notes.forEach((n) => {
    md += `- ${n}\n`
  })
  md += `\n---\n\n`

  if (options?.includeExecSummary) {
    md += renderExecSummary(report)
  }

  md += `## サイト全体 — Google Search Console\n\n`
  md += `| 指標 | 現在 | 前年同期 | 変化 |\n`
  md += `|------|------|----------|------|\n`
  md += `| クリック | ${y.gsc.totalClicks.current.toLocaleString()} | ${y.gsc.totalClicks.previous.toLocaleString()} | ${formatDelta(y.gsc.totalClicks)} |\n`
  md += `| インプレッション | ${y.gsc.totalImpressions.current.toLocaleString()} | ${y.gsc.totalImpressions.previous.toLocaleString()} | ${formatDelta(y.gsc.totalImpressions)} |\n`
  md += `| 平均CTR | ${y.gsc.averageCtr.current.toFixed(2)}% | ${y.gsc.averageCtr.previous.toFixed(2)}% | ${formatDelta(y.gsc.averageCtr, { suffix: '%' })} |\n`
  md += `| 平均掲載順位 | ${y.gsc.averagePosition.current.toFixed(2)} | ${y.gsc.averagePosition.previous.toFixed(2)} | ${formatDelta(y.gsc.averagePosition, { lowerIsBetter: true })} |\n`
  md += `\n`
  md += insightSiteGscSummary(y.gsc)

  {
    const cq = siteWide.current.gsc.allQueries ?? []
    const yq = siteWide.yearAgo.gsc.allQueries ?? []

    const port = summarizeQueryPortfolioBySeason(cq)
    const totalClicks = port.seasonalClicks + port.evergreenClicks
    const totalImp = port.seasonalImpressions + port.evergreenImpressions
    md += `### クエリポートフォリオ（季節語の目安・現在期間）\n\n`
    md += `クエリ文字列に「お歳暮」「お中元」等の**ルール**が含まれる行を季節寄り、それ以外を通年寄りとして集計しています（\`src/lib/querySeason.ts\`）。四半期レビューでは通年比率の推移を確認してください（\`docs/SEO_STRATEGY_GOVERNANCE.md\`）。\n\n`
    md += `| 区分 | クエリ行数 | クリック | シェア | インプレッション | シェア |\n`
    md += `|------|------------|----------|--------|------------------|--------|\n`
    md += `| 季節語ヒット | ${port.seasonalQueryRows.toLocaleString()} | ${port.seasonalClicks.toLocaleString()} | ${totalClicks ? ((port.seasonalClicks / totalClicks) * 100).toFixed(1) : '0.0'}% | ${port.seasonalImpressions.toLocaleString()} | ${totalImp ? ((port.seasonalImpressions / totalImp) * 100).toFixed(1) : '0.0'}% |\n`
    md += `| 通年寄り | ${port.evergreenQueryRows.toLocaleString()} | ${port.evergreenClicks.toLocaleString()} | ${totalClicks ? ((port.evergreenClicks / totalClicks) * 100).toFixed(1) : '0.0'}% | ${port.evergreenImpressions.toLocaleString()} | ${totalImp ? ((port.evergreenImpressions / totalImp) * 100).toFixed(1) : '0.0'}% |\n`
    md += `\n`
    md += insightQueryPortfolio(port, 'site')

    const topQ = topCurrentWithYoYForQueries(cq, yq, 25)
    md += `### 検索クエリ（現在クリック上位 25 件 × 前年同期）\n\n`
    md += `| 順位 | クエリ | 現在クリック | 前年クリック | 増減 | 変化率 |\n`
    md += `|------|--------|-------------|-------------|------|--------|\n`
    topQ.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.query)} | ${row.currentClicks.toLocaleString()} | ${row.yearAgoClicks.toLocaleString()} | ${row.delta >= 0 ? '+' : ''}${row.delta.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightTopQueries(topQ, 'site')

    const growingQ = findGrowingQueries(cq, yq, { minYearAgoClicks: 30, minGain: 1, limit: 25 })
    md += `### 検索クエリ（前年同期比で伸長したもの）\n\n`
    md += `前年同期よりクリックが増えたクエリを、**クリック増加幅**の大きい順に最大 25 件表示しています（前年 30 クリック以上、または前年 0 で現在 25 クリック以上）。\n\n`
    md += `| 順位 | クエリ | 現在クリック | 前年クリック | 増加 | 変化率 |\n`
    md += `|------|--------|-------------|-------------|------|--------|\n`
    growingQ.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.key)} | ${row.currentClicks.toLocaleString()} | ${row.yearAgoClicks.toLocaleString()} | ${row.clickGain.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightGrowingQueries(growingQ, 'site')

    const declinedQ = findDeclinedQueries(cq, yq, { minYearAgoClicks: 50, limit: 25 })
    md += `### 検索クエリ（前年同期に強かったが減少したもの）\n\n`
    md += `前年同期のクリックが **50 以上** かつ現在のクリックが前年より少ないクエリを、**クリック減少幅**の大きい順に最大 25 件表示しています。\n\n`
    md += `| 順位 | クエリ | 前年クリック | 現在クリック | 減少 | 変化率 |\n`
    md += `|------|--------|-------------|-------------|------|--------|\n`
    declinedQ.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.key)} | ${row.yearAgoClicks.toLocaleString()} | ${row.currentClicks.toLocaleString()} | ${row.clickDrop.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightDeclinedQueries(declinedQ, 'site')

    const cp = siteWide.current.gsc.allPages ?? []
    const yp = siteWide.yearAgo.gsc.allPages ?? []
    const topP = topCurrentWithYoYForPages(cp, yp, 25)
    md += `### ランディングページ（現在クリック上位 25 件 × 前年同期）\n\n`
    md += `| 順位 | URL | 現在クリック | 前年クリック | 増減 | 変化率 |\n`
    md += `|------|-----|-------------|-------------|------|--------|\n`
    topP.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.page)} | ${row.currentClicks.toLocaleString()} | ${row.yearAgoClicks.toLocaleString()} | ${row.delta >= 0 ? '+' : ''}${row.delta.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightTopPages(topP, 'site')

    const growingP = findGrowingPages(cp, yp, { minYearAgoClicks: 20, minGain: 1, limit: 25 })
    md += `### ランディングページ（前年同期比で伸長したもの）\n\n`
    md += `前年同期よりクリックが増えた URL を、**クリック増加幅**の大きい順に最大 25 件表示しています。\n\n`
    md += `| 順位 | URL | 現在クリック | 前年クリック | 増加 | 変化率 |\n`
    md += `|------|-----|-------------|-------------|------|--------|\n`
    growingP.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.key)} | ${row.currentClicks.toLocaleString()} | ${row.yearAgoClicks.toLocaleString()} | ${row.clickGain.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightGrowingPages(growingP, 'site')

    const declinedP = findDeclinedPages(cp, yp, { minYearAgoClicks: 30, limit: 25 })
    md += `### ランディングページ（前年同期に強かったが減少したもの）\n\n`
    md += `前年同期のクリックが **30 以上** かつ現在のクリックが前年より少ない URL を、**クリック減少幅**の大きい順に最大 25 件表示しています。\n\n`
    md += `| 順位 | URL | 前年クリック | 現在クリック | 減少 | 変化率 |\n`
    md += `|------|-----|-------------|-------------|------|--------|\n`
    declinedP.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.key)} | ${row.yearAgoClicks.toLocaleString()} | ${row.currentClicks.toLocaleString()} | ${row.clickDrop.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightDeclinedPages(declinedP, 'site')
  }

  md += `## サイト全体 — GA4（集客・購入）\n\n`
  md += `| 指標 | 現在 | 前年同期 | 変化 |\n`
  md += `|------|------|----------|------|\n`
  md += `| セッション | ${y.ga4.sessions.current.toLocaleString()} | ${y.ga4.sessions.previous.toLocaleString()} | ${formatDelta(y.ga4.sessions)} |\n`
  md += `| ユーザー | ${y.ga4.users.current.toLocaleString()} | ${y.ga4.users.previous.toLocaleString()} | ${formatDelta(y.ga4.users)} |\n`
  md += `| ページビュー | ${y.ga4.pageViews.current.toLocaleString()} | ${y.ga4.pageViews.previous.toLocaleString()} | ${formatDelta(y.ga4.pageViews)} |\n`
  md += `| 購入完了（件数） | ${y.ga4.transactions.current.toLocaleString()} | ${y.ga4.transactions.previous.toLocaleString()} | ${formatDelta(y.ga4.transactions)} |\n`
  md += `| 売上（推定） | ¥${y.ga4.revenue.current.toLocaleString()} | ¥${y.ga4.revenue.previous.toLocaleString()} | ${formatDelta(y.ga4.revenue, { suffix: '円' })} |\n`
  md += `| CVR（セッション比） | ${y.ga4.conversionRate.current.toFixed(2)}% | ${y.ga4.conversionRate.previous.toFixed(2)}% | ${formatDelta(y.ga4.conversionRate, { suffix: '%' })} |\n`
  md += `\n`
  md += insightGa4Summary(y.ga4)

  md += `### チャネル別（現在期間）\n\n`
  md += `| チャネル | セッション | ユーザー | 購入完了 | 売上 |\n`
  md += `|----------|-----------|----------|----------|------|\n`
  siteWide.current.ga4.byChannel.forEach((row) => {
    md += `| ${row.channel} | ${row.sessions.toLocaleString()} | ${row.users.toLocaleString()} | ${row.transactions.toLocaleString()} | ¥${row.revenue.toLocaleString()} |\n`
  })
  md += `\n`

  md += `### チャネル別（前年同期）\n\n`
  md += `| チャネル | セッション | ユーザー | 購入完了 | 売上 |\n`
  md += `|----------|-----------|----------|----------|------|\n`
  siteWide.yearAgo.ga4.byChannel.forEach((row) => {
    md += `| ${row.channel} | ${row.sessions.toLocaleString()} | ${row.users.toLocaleString()} | ${row.transactions.toLocaleString()} | ¥${row.revenue.toLocaleString()} |\n`
  })
  md += `\n`
  md += insightChannels(siteWide.current.ga4.byChannel, siteWide.yearAgo.ga4.byChannel)

  md += `### デバイス別（現在 / 前年）\n\n`
  md += `**現在**\n\n`
  md += `| デバイス | セッション | ユーザー | 購入完了 | 売上 |\n`
  md += `|----------|-----------|----------|----------|------|\n`
  siteWide.current.ga4.byDevice.forEach((row) => {
    md += `| ${row.device} | ${row.sessions.toLocaleString()} | ${row.users.toLocaleString()} | ${row.transactions.toLocaleString()} | ¥${row.revenue.toLocaleString()} |\n`
  })
  md += `\n**前年同期**\n\n`
  md += `| デバイス | セッション | ユーザー | 購入完了 | 売上 |\n`
  md += `|----------|-----------|----------|----------|------|\n`
  siteWide.yearAgo.ga4.byDevice.forEach((row) => {
    md += `| ${row.device} | ${row.sessions.toLocaleString()} | ${row.users.toLocaleString()} | ${row.transactions.toLocaleString()} | ¥${row.revenue.toLocaleString()} |\n`
  })
  md += `\n`
  md += insightDevices(siteWide.current.ga4.byDevice, siteWide.yearAgo.ga4.byDevice)
  md += `\n---\n\n`

  const my = magazine.yearOverYear
  md += `## /magazine/ — GSC\n\n`
  md += `| 指標 | 現在 | 前年同期 | 変化 |\n`
  md += `|------|------|----------|------|\n`
  md += `| クリック | ${my.gsc.totalClicks.current.toLocaleString()} | ${my.gsc.totalClicks.previous.toLocaleString()} | ${formatDelta(my.gsc.totalClicks)} |\n`
  md += `| インプレッション | ${my.gsc.totalImpressions.current.toLocaleString()} | ${my.gsc.totalImpressions.previous.toLocaleString()} | ${formatDelta(my.gsc.totalImpressions)} |\n`
  md += `| 平均CTR | ${my.gsc.averageCtr.current.toFixed(2)}% | ${my.gsc.averageCtr.previous.toFixed(2)}% | ${formatDelta(my.gsc.averageCtr, { suffix: '%' })} |\n`
  md += `| 平均掲載順位 | ${my.gsc.averagePosition.current.toFixed(2)} | ${my.gsc.averagePosition.previous.toFixed(2)} | ${formatDelta(my.gsc.averagePosition, { lowerIsBetter: true })} |\n`
  md += `\n`
  md += insightMagazineGsc(my.gsc, y.gsc)

  {
    const mcq = magazine.current.gsc.allQueries
    const myq = magazine.yearAgo.gsc.allQueries

    const mPort = summarizeQueryPortfolioBySeason(mcq)
    const mTotalC = mPort.seasonalClicks + mPort.evergreenClicks
    const mTotalI = mPort.seasonalImpressions + mPort.evergreenImpressions
    md += `### マガジン クエリポートフォリオ（季節語の目安・現在期間）\n\n`
    md += `| 区分 | クエリ行数 | クリック | シェア | インプレッション | シェア |\n`
    md += `|------|------------|----------|--------|------------------|--------|\n`
    md += `| 季節語ヒット | ${mPort.seasonalQueryRows.toLocaleString()} | ${mPort.seasonalClicks.toLocaleString()} | ${mTotalC ? ((mPort.seasonalClicks / mTotalC) * 100).toFixed(1) : '0.0'}% | ${mPort.seasonalImpressions.toLocaleString()} | ${mTotalI ? ((mPort.seasonalImpressions / mTotalI) * 100).toFixed(1) : '0.0'}% |\n`
    md += `| 通年寄り | ${mPort.evergreenQueryRows.toLocaleString()} | ${mPort.evergreenClicks.toLocaleString()} | ${mTotalC ? ((mPort.evergreenClicks / mTotalC) * 100).toFixed(1) : '0.0'}% | ${mPort.evergreenImpressions.toLocaleString()} | ${mTotalI ? ((mPort.evergreenImpressions / mTotalI) * 100).toFixed(1) : '0.0'}% |\n`
    md += `\n`
    md += insightQueryPortfolio(mPort, 'magazine')

    const mTopQ = topCurrentWithYoYForQueries(mcq, myq, 20)
    md += `### マガジン 検索クエリ（現在クリック上位 20 件 × 前年同期）\n\n`
    md += `| 順位 | クエリ | 現在クリック | 前年クリック | 増減 | 変化率 |\n`
    md += `|------|--------|-------------|-------------|------|--------|\n`
    mTopQ.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.query)} | ${row.currentClicks.toLocaleString()} | ${row.yearAgoClicks.toLocaleString()} | ${row.delta >= 0 ? '+' : ''}${row.delta.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightTopQueries(mTopQ, 'magazine')

    const mGrowQ = findGrowingQueries(mcq, myq, { minYearAgoClicks: 15, minGain: 1, limit: 20 })
    md += `### マガジン 検索クエリ（前年同期比で伸長したもの）\n\n`
    md += `| 順位 | クエリ | 現在クリック | 前年クリック | 増加 | 変化率 |\n`
    md += `|------|--------|-------------|-------------|------|--------|\n`
    mGrowQ.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.key)} | ${row.currentClicks.toLocaleString()} | ${row.yearAgoClicks.toLocaleString()} | ${row.clickGain.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightGrowingQueries(mGrowQ, 'magazine')

    const mDeclQ = findDeclinedQueries(mcq, myq, { minYearAgoClicks: 20, limit: 20 })
    md += `### マガジン 検索クエリ（前年同期に強かったが減少したもの）\n\n`
    md += `前年同期のクリックが **20 以上** かつ現在より少ないクエリを、クリック減少幅の大きい順に最大 20 件です。\n\n`
    md += `| 順位 | クエリ | 前年クリック | 現在クリック | 減少 | 変化率 |\n`
    md += `|------|--------|-------------|-------------|------|--------|\n`
    mDeclQ.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.key)} | ${row.yearAgoClicks.toLocaleString()} | ${row.currentClicks.toLocaleString()} | ${row.clickDrop.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightDeclinedQueries(mDeclQ, 'magazine')

    const mcp = magazine.current.gsc.allPages
    const myp = magazine.yearAgo.gsc.allPages
    const mTopP = topCurrentWithYoYForPages(mcp, myp, 20)
    md += `### マガジン ページ（現在クリック上位 20 件 × 前年同期）\n\n`
    md += `| 順位 | URL | 現在クリック | 前年クリック | 増減 | 変化率 |\n`
    md += `|------|-----|-------------|-------------|------|--------|\n`
    mTopP.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.page)} | ${row.currentClicks.toLocaleString()} | ${row.yearAgoClicks.toLocaleString()} | ${row.delta >= 0 ? '+' : ''}${row.delta.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightTopPages(mTopP, 'magazine')

    const mGrowP = findGrowingPages(mcp, myp, { minYearAgoClicks: 10, minGain: 1, limit: 20 })
    md += `### マガジン ページ（前年同期比で伸長したもの）\n\n`
    md += `| 順位 | URL | 現在クリック | 前年クリック | 増加 | 変化率 |\n`
    md += `|------|-----|-------------|-------------|------|--------|\n`
    mGrowP.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.key)} | ${row.currentClicks.toLocaleString()} | ${row.yearAgoClicks.toLocaleString()} | ${row.clickGain.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightGrowingPages(mGrowP, 'magazine')

    const mDeclP = findDeclinedPages(mcp, myp, { minYearAgoClicks: 15, limit: 20 })
    md += `### マガジン ページ（前年同期に強かったが減少したもの）\n\n`
    md += `前年同期のクリックが **15 以上** かつ現在より少ない URL を、クリック減少幅の大きい順に最大 20 件です。\n\n`
    md += `| 順位 | URL | 前年クリック | 現在クリック | 減少 | 変化率 |\n`
    md += `|------|-----|-------------|-------------|------|--------|\n`
    mDeclP.forEach((row, index) => {
      md += `| ${index + 1} | ${mdEscapeCell(row.key)} | ${row.yearAgoClicks.toLocaleString()} | ${row.currentClicks.toLocaleString()} | ${row.clickDrop.toLocaleString()} | ${formatPct(row.pctChange)} |\n`
    })
    md += `\n`
    md += insightDeclinedPages(mDeclP, 'magazine')
  }

  md += `## /magazine/ — GA4（トラフィック）\n\n`
  md += `| 指標 | 現在 | 前年同期 | 変化 |\n`
  md += `|------|------|----------|------|\n`
  md += `| セッション | ${my.ga4.sessions.current.toLocaleString()} | ${my.ga4.sessions.previous.toLocaleString()} | ${formatDelta(my.ga4.sessions)} |\n`
  md += `| ユーザー | ${my.ga4.users.current.toLocaleString()} | ${my.ga4.users.previous.toLocaleString()} | ${formatDelta(my.ga4.users)} |\n`
  md += `| ページビュー | ${my.ga4.pageViews.current.toLocaleString()} | ${my.ga4.pageViews.previous.toLocaleString()} | ${formatDelta(my.ga4.pageViews)} |\n`
  md += `\n`
  md += insightMagazineGa4(my.ga4)
  md += `*サイト全体の売上・購入完了は上記「サイト全体」セクションを参照してください。*\n\n`
  md += `### 戦略レビュー（ドキュメント）\n\n`
  md += `- 四半期アジェンダ: \`docs/SEO_STRATEGY_GOVERNANCE.md\`\n`
  md += `- 法人意図のプロキシと GA4 の限界: \`docs/GA4_CORPORATE_INTENT_PROXY.md\`\n`
  md += `- （本 Markdown を \`docs/\` 以外に保存した場合は、上記パスに \`docs/\` を付与して参照してください）\n\n`

  if (options?.monthlyTrend && options.monthlyTrend.length > 0) {
    md += `---\n\n`
    md += renderMonthlyTrendMarkdown(options.monthlyTrend)
  }

  md += `---\n\n*自動生成レポート*\n`

  return md
}

export function renderMonthlySiteReportMarkdown(
  report: ComprehensiveReportResponse,
  monthlyTrend: MonthlyTrendSeries
): string {
  return renderComprehensiveMarkdown(report, {
    includeExecSummary: true,
    monthlyTrend,
  })
}
