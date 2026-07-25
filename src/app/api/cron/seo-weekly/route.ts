import { NextRequest, NextResponse } from 'next/server'
import { buildWeeklySeoReport } from '@/lib/buildWeeklySeoReport'
import { isSlackBotConfigured, postSlackMessage, postToSlack } from '@/lib/slackClient'
import {
  saveLastPostRecord,
  shouldSkipDuplicatePost,
  isSeoWeeklyPostingEnabled,
} from '@/lib/seoWeeklyDedupe'
import {
  formatSeoWeeklyMessage,
  formatSeoWeeklyParentMessage,
  formatSeoWeeklyThreadMessages,
} from '@/lib/slackSeoMessage'

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
      console.error('[SEO Weekly Cron] Unauthorized: Invalid or missing Authorization header')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[SEO Weekly Cron] Warning: CRON_SECRET not set, allowing unauthenticated access')
  }

  return null
}

/**
 * 週次 SEO / KPI モニタリングを Slack に投稿
 * cron-job.org 等から毎週月曜 8:00 JST に呼び出し
 *
 * 認証: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  try {
    const report = await buildWeeklySeoReport()
    const dryRun = isDryRun(req)

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Report built without posting to Slack',
        weekKey: report.weekKey,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
        threaded: isSlackBotConfigured(),
        threadCount: isSlackBotConfigured() ? formatSeoWeeklyThreadMessages(report).length : 1,
      })
    }

    if (shouldSkipDuplicatePost(report.weekKey)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `Already posted for weekKey ${report.weekKey}; skipping duplicate Slack post`,
        weekKey: report.weekKey,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
      })
    }

    if (!isSeoWeeklyPostingEnabled()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'SEO_WEEKLY_POSTING_ENABLED is false; Slack posting disabled',
        weekKey: report.weekKey,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
      })
    }

    saveLastPostRecord(report.weekKey)

    if (isSlackBotConfigured()) {
      const parentTs = await postSlackMessage(formatSeoWeeklyParentMessage(report))
      const threads = formatSeoWeeklyThreadMessages(report)
      for (const thread of threads) {
        await postSlackMessage(thread, { threadTs: parentTs })
      }

      return NextResponse.json({
        success: true,
        message: 'SEO weekly report posted to Slack',
        weekKey: report.weekKey,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
        threaded: true,
        threadCount: threads.length,
      })
    } else {
      await postToSlack(formatSeoWeeklyMessage(report))

      return NextResponse.json({
        success: true,
        message: 'SEO weekly report posted to Slack',
        weekKey: report.weekKey,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
        threaded: false,
        threadCount: 1,
      })
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to post SEO weekly report'
    console.error('[SEO Weekly Cron] Error:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
