import { NextRequest, NextResponse } from 'next/server'

/**
 * 26SS→26FW 相対表の FW 商品をシード／クロールする。
 * 認証: Authorization: Bearer {CRON_SECRET}
 *
 * GET/POST /api/cron/crawl-season-map
 * GET/POST /api/cron/crawl-season-map?seed_only=1
 */
async function handle(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret) {
      const expectedAuth = `Bearer ${cronSecret.trim()}`
      const receivedAuth = (authHeader || '').trim()
      if (receivedAuth !== expectedAuth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      console.warn('[SeasonMap Cron] CRON_SECRET not set, allowing unauthenticated access')
    }

    const seedOnly =
      req.nextUrl.searchParams.get('seed_only') === '1' ||
      req.nextUrl.searchParams.get('seed_only') === 'true'

    const { startSeasonMapCrawl } = await import('@/lib/seasonCrawl')
    const logId = await startSeasonMapCrawl({ seedOnly })

    return NextResponse.json({
      success: true,
      message: seedOnly ? 'Season map seed triggered' : 'Season map crawl triggered',
      log_id: logId,
      seed_only: seedOnly,
    })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to execute season map crawl'
    console.error('[SeasonMap Cron] Error:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
