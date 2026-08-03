import { NextRequest, NextResponse } from 'next/server'
import { buildMonthlySeoReport } from '@/lib/buildMonthlySeoReport'
import { isSlackBotConfigured, postSlackMessage, postToSlack } from '@/lib/slackClient'
import {
  saveLastPostRecord,
  shouldSkipDuplicatePost,
  isSeoMonthlyPostingEnabled,
} from '@/lib/seoMonthlyDedupe'
import {
  formatSeoMonthlyMessage,
  formatSeoMonthlyParentMessage,
  formatSeoMonthlyThreadMessages,
} from '@/lib/slackMonthlyMessage'

function isDryRun(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('dryRun') === '1'
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

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Report built without posting to Slack',
        monthKey: report.monthKey,
        monthStart: report.monthStart,
        monthEnd: report.monthEnd,
        threaded: isSlackBotConfigured(),
        threadCount: isSlackBotConfigured() ? formatSeoMonthlyThreadMessages(report).length : 1,
      })
    }

    if (shouldSkipDuplicatePost(report.monthKey)) {
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
      const parentTs = await postSlackMessage(formatSeoMonthlyParentMessage(report))
      const threads = formatSeoMonthlyThreadMessages(report)
      for (const thread of threads) {
        await postSlackMessage(thread, { threadTs: parentTs })
      }
      saveLastPostRecord(report.monthKey)

      return NextResponse.json({
        success: true,
        message: 'SEO monthly report posted to Slack',
        monthKey: report.monthKey,
        monthStart: report.monthStart,
        monthEnd: report.monthEnd,
        threaded: true,
        threadCount: threads.length,
      })
    }

    await postToSlack(formatSeoMonthlyMessage(report))
    saveLastPostRecord(report.monthKey)

    return NextResponse.json({
      success: true,
      message: 'SEO monthly report posted to Slack',
      monthKey: report.monthKey,
      monthStart: report.monthStart,
      monthEnd: report.monthEnd,
      threaded: false,
      threadCount: 1,
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
