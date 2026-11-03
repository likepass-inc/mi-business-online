/**
 * 暦月のサイト集客・売上レポートを生成し、
 * content/monthly/YYYY-MM/（セクション分割）と docs/MONTHLY_REPORT_YYYY-MM.md に保存します。
 *
 * 前提: .env.local に GA4_PROPERTY_ID 等を設定するか、環境変数をエクスポート済みであること。
 *
 * 使用例:
 *   npx tsx scripts/generate-monthly-site-report.ts
 *   MONTH_KEY=2026-08 npx tsx scripts/generate-monthly-site-report.ts
 */
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { buildComprehensiveReport } from '../src/lib/buildComprehensiveReport'
import { buildMonthlyTrendSeries } from '../src/lib/buildMonthlyTrendSeries'
import { renderMonthlySiteReportMarkdown } from '../src/lib/comprehensiveReportMarkdown'
import { getCalendarMonthPeriod, getYearOverYearPeriod } from '../src/lib/dateUtils'
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

async function main() {
  const monthKey = parseMonthKey(process.env.MONTH_KEY)
  const { monthStart, monthEnd } = getCalendarMonthPeriod(monthKey)
  const { startDate: yoyMonthStart, endDate: yoyMonthEnd } = getYearOverYearPeriod(
    monthStart,
    monthEnd
  )
  const [year, month] = monthKey.split('-')
  const monthLabel = `${year}年${parseInt(month, 10)}月`

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
}

main().catch((e) => {
  console.error('❌ エラー:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
