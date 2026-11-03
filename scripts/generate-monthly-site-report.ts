/**
 * 暦月のサイト集客・売上レポートを生成し、
 * content/monthly/YYYY-MM/（セクション分割 + charts.json）と docs/MONTHLY_REPORT_YYYY-MM.md に保存します。
 *
 * 前提: .env.local に GA4_PROPERTY_ID 等を設定するか、環境変数をエクスポート済みであること。
 * AI 検索: SITE_SEARCH_EFFECT_BASIC_USER / SITE_SEARCH_EFFECT_BASIC_PASSWORD（任意）
 *
 * 使用例:
 *   npx tsx scripts/generate-monthly-site-report.ts
 *   MONTH_KEY=2026-08 npx tsx scripts/generate-monthly-site-report.ts
 */
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { buildComprehensiveReport } from '../src/lib/buildComprehensiveReport'
import { buildMonthlyChartsPayload } from '../src/lib/buildMonthlyChartsPayload'
import { buildMonthlyFunnel } from '../src/lib/buildMonthlyFunnel'
import { buildMonthlyTrendSeries } from '../src/lib/buildMonthlyTrendSeries'
import { renderMonthlySiteReportMarkdown } from '../src/lib/comprehensiveReportMarkdown'
import { getCalendarMonthPeriod, getYearOverYearPeriod } from '../src/lib/dateUtils'
import {
  fetchSiteSearchEffectYoY,
  isSiteSearchEffectConfigured,
} from '../src/lib/fetchSiteSearchEffectReport'
import { formatMonthLabel } from '../src/lib/monthlyReportSections'
import { renderAiSearchMarkdown, renderFunnelMarkdown } from '../src/lib/monthlyExtraMarkdown'
import { writeMonthlyReportArchive } from '../src/lib/writeMonthlyReportArchive'

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
}

function parseMonthKey(raw: string | undefined): string {
  const value = raw?.trim() || '2026-08'
  getCalendarMonthPeriod(value)
  return value
}

function yoyMonthKeyFromStart(yoyMonthStart: string): string {
  return yoyMonthStart.slice(0, 7)
}

async function main() {
  const monthKey = parseMonthKey(process.env.MONTH_KEY)
  const { monthStart, monthEnd } = getCalendarMonthPeriod(monthKey)
  const { startDate: yoyMonthStart, endDate: yoyMonthEnd } = getYearOverYearPeriod(
    monthStart,
    monthEnd
  )
  const yoyMonthKey = yoyMonthKeyFromStart(yoyMonthStart)
  const monthLabel = formatMonthLabel(monthKey)
  const yoyLabel = formatMonthLabel(yoyMonthKey)

  console.log(`📊 ${monthLabel} サイト集客・売上レポートを生成中...\n`)
  console.log(`  期間: ${monthStart} 〜 ${monthEnd}`)
  console.log('  取得中: 包括レポート（サイト / マガジン × 当年・前年）')

  const report = await buildComprehensiveReport({
    startDate: monthStart,
    endDate: monthEnd,
  })

  const gscLagFrom = monthEnd.replace(
    /\d{2}$/,
    String(Math.max(1, parseInt(monthEnd.slice(-2), 10) - 1)).padStart(2, '0')
  )
  report.meta.notes.push(
    `本レポートは暦月確定直後の生成です。Google Search Console の反映遅延により、月末数日（特に ${gscLagFrom}〜${monthEnd}）のクリック・インプレッションは今後更新される場合があります。`
  )

  console.log('  取得中: 直近13ヶ月の推移')
  const monthlyTrend = await buildMonthlyTrendSeries(monthKey)

  console.log('  取得中: 集客→購入ファネル（当年・前年）')
  const funnel = await buildMonthlyFunnel({
    monthStart,
    monthEnd,
    yoyMonthStart,
    yoyMonthEnd,
  })

  let aiSearch: Awaited<ReturnType<typeof fetchSiteSearchEffectYoY>> = null
  if (isSiteSearchEffectConfigured()) {
    console.log('  取得中: AIサイト内検索 効果分析（当年・前年）')
    try {
      aiSearch = await fetchSiteSearchEffectYoY({
        monthStart,
        monthEnd,
        yoyMonthStart,
        yoyMonthEnd,
      })
    } catch (e) {
      console.warn(
        `  ⚠ AIサイト内検索の取得に失敗しました: ${e instanceof Error ? e.message : String(e)}`
      )
      aiSearch = null
    }
  } else {
    console.log('  スキップ: AIサイト内検索（SITE_SEARCH_EFFECT_BASIC_* 未設定）')
  }

  const charts = buildMonthlyChartsPayload({
    monthKey,
    yoyMonthKey,
    comprehensive: report,
    trends: monthlyTrend,
    funnel,
    aiSearch,
  })

  const extraSections = {
    funnel: renderFunnelMarkdown({
      monthLabel,
      yoyLabel,
      current: funnel.current,
      yearAgo: funnel.yearAgo,
    }),
    ...(aiSearch
      ? {
          'ai-search': renderAiSearchMarkdown({
            monthLabel,
            yoyLabel,
            current: aiSearch.current,
            yearAgo: aiSearch.yearAgo,
          }),
        }
      : {}),
  }

  const sources = ['Google Search Console', 'GA4']
  if (aiSearch) sources.push('AIサイト内検索')

  const markdown = renderMonthlySiteReportMarkdown(report, monthlyTrend)
  const mdPath = resolve(process.cwd(), `docs/MONTHLY_REPORT_${monthKey}.md`)
  writeFileSync(mdPath, markdown, 'utf-8')

  const archive = writeMonthlyReportArchive({
    monthKey,
    markdown,
    periodStart: monthStart,
    periodEnd: monthEnd,
    yoyPeriodStart: yoyMonthStart,
    yoyPeriodEnd: yoyMonthEnd,
    charts,
    extraSections,
    sources,
  })

  const y = report.siteWide.yearOverYear
  console.log(`\n✅ Markdown: ${mdPath}`)
  console.log(`✅ Archive: ${archive.contentDir} (${archive.written.join(', ')})\n`)
  console.log('--- サイト全体プレビュー ---')
  console.log(
    `  クリック: ${y.gsc.totalClicks.current.toLocaleString()}（前年 ${y.gsc.totalClicks.previous.toLocaleString()}）`
  )
  console.log(
    `  セッション: ${y.ga4.sessions.current.toLocaleString()}（前年 ${y.ga4.sessions.previous.toLocaleString()}）`
  )
  console.log(
    `  購入完了: ${y.ga4.transactions.current.toLocaleString()}（前年 ${y.ga4.transactions.previous.toLocaleString()}）`
  )
  console.log(
    `  売上: ¥${y.ga4.revenue.current.toLocaleString()}（前年 ¥${y.ga4.revenue.previous.toLocaleString()}）`
  )
  if (aiSearch) {
    console.log(
      `  AI検索: ${aiSearch.current.totalSearches.toLocaleString()}（前年 ${aiSearch.yearAgo.totalSearches.toLocaleString()}）`
    )
  }
}

main().catch((e) => {
  console.error('❌ エラー:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
