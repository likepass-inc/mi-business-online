import { NextRequest, NextResponse } from 'next/server'

function verifyCronAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const expectedAuth = `Bearer ${cronSecret.trim()}`
    const receivedAuth = (authHeader || '').trim()
    if (receivedAuth !== expectedAuth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  return null
}

/**
 * @deprecated Daily KPI Bot は Weekly KPI Bot に移行しました。
 * 新エンドポイント: GET /api/cron/seo-weekly
 */
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message:
        'Daily KPI Bot is deprecated. Use GET /api/cron/seo-weekly instead (every Monday 08:00 JST).',
      migrateTo: '/api/cron/seo-weekly',
    },
    { status: 410 }
  )
}

export async function POST(req: NextRequest) {
  return GET(req)
}
