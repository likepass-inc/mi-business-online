import { NextRequest, NextResponse } from 'next/server'
import { buildMonthlySeoReport } from '@/lib/buildMonthlySeoReport'
import { renderAllMonthlyTrendCharts } from '@/lib/monthlyTrendCharts'
import {
  isSlackBotConfigured,
  postSlackFile,
  postSlackMessage,
  postToSlack,
} from '@/lib/slackClient'
import {
  saveLastPostRecord,
  shouldSkipDuplicatePost,
  isSeoMonthlyPostingEnabled,
} from '@/lib/seoMonthlyDedupe'
import {
  formatSeoMonthlyMessage,
  formatSeoMonthlyChartsParentMessage,
  formatSeoMonthlyParentMessage,
  formatSeoMonthlyThreadMessages,
  getMonthlyTrendChartCaptions,
  getMonthlyTrendChartCount,
} from '@/lib/slackMonthlyMessage'

export const maxDuration = 300

function isDryRun(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('dryRun') === '1'
}

function isChartsOnly(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('chartsOnly') === '1'
}

function verifyCronAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const expectedAuth = `Bearer ${cronSecret.trim()}`
    const receivedAuth = (authHeader || '').trim()
    if (receivedAuth !== expectedAuth) {
      console.error('[SEO Monthly Cron] Unauthorized: Invalid or missing Authorization header')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[SEO Monthly Cron] Warning: CRON_SECRET not set, allowing unauthenticated access')
  }

  return null
}

async function postMonthlyTrendCharts(
  report: Awaited<ReturnType<typeof buildMonthlySeoReport>>,
  parentTs: string
): Promise<number> {
  const charts = await renderAllMonthlyTrendCharts(report.monthlyTrend, report.monthKey)
  const captions = getMonthlyTrendChartCaptions(report)
  const captionById = new Map(captions.map((c) => [c.metricId, c]))

  for (const { metric, png } of charts) {
    const meta = captionById.get(metric.id)
    await postSlackFile(png, meta?.filename ?? `monthly-trend-${metric.id}.png`, {
      threadTs: parentTs,
      initialComment: meta?.caption ?? metric.title,
    })
  }

  return charts.length
}

/**
 * 月次 SEO / KPI モニタリングを Slack に投稿
 * GitHub Actions 等から毎月第1月曜 8:00 JST に呼び出し
 *
 * 認証: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  try {
    const report = await buildMonthlySeoReport()
    const dryRun = isDryRun(req)
    const chartsOnly = isChartsOnly(req)
    const textThreadCount = isSlackBotConfigured()
      ? formatSeoMonthlyThreadMessages(report).length
      : 1
    const chartCount = getMonthlyTrendChartCount()
    const trendMonths = report.monthlyTrend.map((p) => p.monthKey)

    if (dryRun) {
      await renderAllMonthlyTrendCharts(report.monthlyTrend, report.monthKey)
      return NextResponse.json({
        success: true,
        dryRun: true,
        chartsOnly,
        message: 'Report built without posting to Slack',
        monthKey: report.monthKey,
        monthStart: report.monthStart,
        monthEnd: report.monthEnd,
        threaded: isSlackBotConfigured(),
        threadCount: chartsOnly ? 0 : textThreadCount,
        chartCount,
        trendMonths,
      })
    }

    if (!chartsOnly && shouldSkipDuplicatePost(report.monthKey)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `Already posted for monthKey ${report.monthKey}; skipping duplicate Slack post`,
        monthKey: report.monthKey,
        monthStart: report.monthStart,
        monthEnd: report.monthEnd,
      })
    }

    if (!isSeoMonthlyPostingEnabled()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'SEO_MONTHLY_POSTING_ENABLED is false; Slack posting disabled',
        monthKey: report.monthKey,
        monthStart: report.monthStart,
        monthEnd: report.monthEnd,
      })
    }

    if (isSlackBotConfigured()) {
      if (chartsOnly) {
        const parentTs = await postSlackMessage(formatSeoMonthlyChartsParentMessage(report))
        const chartsPosted = await postMonthlyTrendCharts(report, parentTs)

        return NextResponse.json({
          success: true,
          message: 'SEO monthly trend charts posted to Slack',
          chartsOnly: true,
          monthKey: report.monthKey,
          monthStart: report.monthStart,
          monthEnd: report.monthEnd,
          threaded: true,
          threadCount: 0,
          chartCount: chartsPosted,
          trendMonths,
        })
      }

      const parentTs = await postSlackMessage(formatSeoMonthlyParentMessage(report))
      const threads = formatSeoMonthlyThreadMessages(report)
      for (const thread of threads) {
        await postSlackMessage(thread, { threadTs: parentTs })
      }
      const chartsPosted = await postMonthlyTrendCharts(report, parentTs)
      saveLastPostRecord(report.monthKey)

      return NextResponse.json({
        success: true,
        message: 'SEO monthly report posted to Slack',
        monthKey: report.monthKey,
        monthStart: report.monthStart,
        monthEnd: report.monthEnd,
        threaded: true,
        threadCount: textThreadCount,
        chartCount: chartsPosted,
        trendMonths,
      })
    }

    await postToSlack(formatSeoMonthlyMessage(report))
    saveLastPostRecord(report.monthKey)

    return NextResponse.json({
      success: true,
      message: 'SEO monthly report posted to Slack (charts skipped: Bot Token not configured)',
      monthKey: report.monthKey,
      monthStart: report.monthStart,
      monthEnd: report.monthEnd,
      threaded: false,
      threadCount: 1,
      chartCount: 0,
      trendMonths,
    })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to post SEO monthly report'
    console.error('[SEO Monthly Cron] Error:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
