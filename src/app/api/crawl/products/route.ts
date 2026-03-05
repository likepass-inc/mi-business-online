import { NextRequest, NextResponse } from 'next/server'
import {
  createCrawlLog,
  updateCrawlLog
} from '@/lib/db/productRepository'
import { runCrawl } from '@/lib/crawlRunner'

/**
 * 全商品のクロールを実行
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const crawlType = body.type === 'incremental' ? 'incremental' : 'full'
    
    console.log(`[Crawl API] Starting ${crawlType} crawl`)
    
    const logId = createCrawlLog(crawlType)
    
    runCrawl(logId, crawlType).catch(error => {
      console.error(`[Crawl API] Crawl ${logId} failed:`, error)
      updateCrawlLog(logId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error)
      })
    })
    
    return NextResponse.json({
      success: true,
      log_id: logId,
      message: `Crawl started (${crawlType})`
    })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to start crawl'
    console.error('[Crawl API] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * クロール実行状況を取得
 */
export async function GET(req: NextRequest) {
  try {
    const { getLatestCrawlLog } = await import('@/lib/db/productRepository')
    const latestLog = getLatestCrawlLog()
    
    if (!latestLog) {
      return NextResponse.json({
        success: true,
        message: 'No crawl logs found'
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

