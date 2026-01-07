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
    const latestLog = getLatestCrawlLog()
    
    if (!latestLog) {
      return NextResponse.json({
        success: true,
        message: 'No crawl logs found',
        log: null
      })
    }
    
    return NextResponse.json({
      success: true,
      log: latestLog
    })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to get crawl status'
    console.error('[Crawl API] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

