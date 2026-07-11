import { NextRequest, NextResponse } from 'next/server'
import { buildDailySeoReport } from '@/lib/buildDailySeoReport'
import { isSlackBotConfigured, postSlackMessage, postToSlack } from '@/lib/slackClient'
import { saveLastPostRecord, shouldSkipDuplicatePost, isSeoDailyPostingEnabled } from '@/lib/seoDailyDedupe'
import {
  formatSeoDailyMessage,
  formatSeoDailyParentMessage,
  formatSeoDailyThreadMessages,
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
      console.error('[SEO Daily Cron] Unauthorized: Invalid or missing Authorization header')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[SEO Daily Cron] Warning: CRON_SECRET not set, allowing unauthenticated access')
  }

  return null
}

/**
 * デイリー SEO モニタリングを Slack に投稿
 * cron-job.org 等から毎朝呼び出し
 *
 * 認証: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  try {
    const report = await buildDailySeoReport()
    const dryRun = isDryRun(req)

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Report built without posting to Slack',
        targetDate: report.targetDate,
        threaded: isSlackBotConfigured(),
        threadCount: isSlackBotConfigured() ? formatSeoDailyThreadMessages(report).length : 1,
      })
    }

    if (shouldSkipDuplicatePost(report.targetDate)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `Already posted for targetDate ${report.targetDate}; skipping duplicate Slack post`,
        targetDate: report.targetDate,
      })
    }

    if (!isSeoDailyPostingEnabled()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'SEO_DAILY_POSTING_ENABLED is false; Slack posting disabled',
        targetDate: report.targetDate,
      })
    }

    // 投稿前に記録して連投・リトライ時の重複を防ぐ
    saveLastPostRecord(report.targetDate)

    if (isSlackBotConfigured()) {
      const parentTs = await postSlackMessage(formatSeoDailyParentMessage(report))
      const threads = formatSeoDailyThreadMessages(report)
      for (const thread of threads) {
        await postSlackMessage(thread, { threadTs: parentTs })
      }

      return NextResponse.json({
        success: true,
        message: 'SEO daily report posted to Slack',
        targetDate: report.targetDate,
        threaded: true,
        threadCount: threads.length,
      })
    } else {
      // Bot Token 未設定時は Webhook で1通にまとめて投稿
      await postToSlack(formatSeoDailyMessage(report))

      return NextResponse.json({
        success: true,
        message: 'SEO daily report posted to Slack',
        targetDate: report.targetDate,
        threaded: false,
        threadCount: 1,
      })
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to post SEO daily report'
    console.error('[SEO Daily Cron] Error:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
