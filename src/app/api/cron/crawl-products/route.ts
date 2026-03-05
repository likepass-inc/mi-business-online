import { NextRequest, NextResponse } from 'next/server'

/**
 * Cron用の商品クロール実行API
 * 外部cronサービス（cron-job.org等）から呼び出し可能
 * 
 * 認証: CRON_SECRET環境変数で保護
 * 
 * 使用方法:
 * - cron-job.org等でこのエンドポイントを毎日呼び出す
 * - ヘッダーに Authorization: Bearer {CRON_SECRET} を含める
 */
export async function GET(req: NextRequest) {
  try {
    // 認証チェック
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret) {
      const expectedAuth = `Bearer ${cronSecret.trim()}`
      const receivedAuth = (authHeader || '').trim()
      if (receivedAuth !== expectedAuth) {
        console.error('[Cron API] Unauthorized: Invalid or missing Authorization header')
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized'
          },
          { status: 401 }
        )
      }
    } else {
      console.warn('[Cron API] Warning: CRON_SECRET not set, allowing unauthenticated access')
    }
    
    // 同プロセスでクロールをバックグラウンド実行（fetch だと Render でリクエスト終了後に動かないため）
    const { createCrawlLog, updateCrawlLog } = await import('@/lib/db/productRepository')
    const { runCrawl } = await import('@/lib/crawlRunner')
    
    const logId = createCrawlLog('incremental')
    console.log('[Cron API] Starting crawl in background, log_id:', logId)
    
    runCrawl(logId, 'incremental').catch(err => {
      console.error('[Cron API] Background crawl failed:', err)
      updateCrawlLog(logId, {
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err)
      })
    })

    return NextResponse.json({ success: true, message: 'Crawl triggered', log_id: logId })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to execute cron crawl'
    console.error('[Cron API] Error:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

/**
 * POSTメソッドもサポート（一部のcronサービスで使用）
 */
export async function POST(req: NextRequest) {
  return GET(req)
}

