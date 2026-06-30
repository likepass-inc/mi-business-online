import { NextRequest, NextResponse } from 'next/server'
import { buildDailySeoReport } from '@/lib/buildDailySeoReport'
import { postToSlack } from '@/lib/slackClient'
import { formatSeoDailyMessage } from '@/lib/slackSeoMessage'

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
    const payload = formatSeoDailyMessage(report)
    await postToSlack(payload)

    return NextResponse.json({
      success: true,
      message: 'SEO daily report posted to Slack',
      targetDate: report.targetDate,
    })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to post SEO daily report'
    console.error('[SEO Daily Cron] Error:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
