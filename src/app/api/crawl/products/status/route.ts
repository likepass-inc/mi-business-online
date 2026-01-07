import { NextRequest, NextResponse } from 'next/server'
import { getLatestCrawlLog } from '@/lib/db/productRepository'

/**
 * クロール実行状況を取得
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const logId = searchParams.get('log_id')
    
    if (logId) {
      // 特定のログIDの情報を取得（将来的に実装）
      return NextResponse.json({
        success: false,
        error: 'Specific log ID lookup not implemented yet'
      }, { status: 501 })
    }
    
    // 最新のクロールログを取得
    console.log('[Crawl API] Fetching latest crawl log...')
    const latestLog = getLatestCrawlLog()
    
    if (!latestLog) {
      console.log('[Crawl API] No crawl logs found')
      return NextResponse.json({
        success: true,
        message: 'No crawl logs found',
        log: null
      })
    }
    
    console.log(`[Crawl API] Found crawl log: ID=${latestLog.id}, Status=${latestLog.status}, Total URLs=${latestLog.total_urls}, Success=${latestLog.success_count}, Errors=${latestLog.error_count}`)
    
    return NextResponse.json({
      success: true,
      log: latestLog
    })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to get crawl status'
    console.error('[Crawl API] Error:', errorMessage)
    console.error('[Crawl API] Error stack:', e instanceof Error ? e.stack : undefined)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

