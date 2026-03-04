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
    
    // クロールを実行（内部APIを呼び出し）
    // req.nextUrl.originが正しく動作しない場合に備えて、環境変数から取得を試みる
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin
    const crawlUrl = `${baseUrl}/api/crawl/products`
    
    console.log('[Cron API] Triggering crawl (fire-and-forget):', crawlUrl)
    
    // クロールはバックグラウンドで開始し、即座に小さなレスポンスだけ返す（output too large 対策）
    fetch(crawlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'incremental' })
    }).catch(err => console.error('[Cron API] Background fetch error:', err))

    return NextResponse.json({ success: true, message: 'Crawl triggered' })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to execute cron crawl'
    console.error('[Cron API] Error:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

/**
 * 直接クロール処理を実行（内部API呼び出しが失敗した場合のフォールバック）
 */
async function executeCrawlDirectly(crawlType: 'full' | 'incremental') {
  try {
    // クロール処理を直接インポートして実行
    const { collectProductUrls } = await import('@/lib/productCrawler')
    const { scrapePage } = await import('@/lib/scraper')
    const { parseProductPage } = await import('@/lib/productParser')
    const {
      createCrawlLog,
      updateCrawlLog,
      batchSaveProducts,
      getProductsNeedingUpdate
    } = await import('@/lib/db/productRepository')
    
    console.log(`[Cron API] Starting direct ${crawlType} crawl execution`)
    
    // クロールログを作成
    const logId = createCrawlLog(crawlType)
    
    // 非同期でクロールを実行（レスポンスを先に返す）
    ;(async () => {
      try {
        let productUrls: string[] = []
        
        if (crawlType === 'incremental') {
          const productsNeedingUpdate = getProductsNeedingUpdate(7)
          productUrls = productsNeedingUpdate.map(p => p.product_url)
          console.log(`[Cron API] Direct incremental crawl: ${productUrls.length} products need update`)
        } else {
          productUrls = await collectProductUrls()
          console.log(`[Cron API] Direct full crawl: ${productUrls.length} products found`)
        }
        
        updateCrawlLog(logId, { total_urls: productUrls.length })
        
        // ここでは簡易的にログのみ更新（実際のクロール処理は時間がかかるため）
        // 完全な実装が必要な場合は、/api/crawl/products/route.tsのexecuteCrawl関数を参照
        console.log(`[Cron API] Direct crawl log created: ${logId}, URLs: ${productUrls.length}`)
        
      } catch (error) {
        console.error(`[Cron API] Direct crawl ${logId} failed:`, error)
        updateCrawlLog(logId, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error)
        })
      }
    })()
    
    return NextResponse.json({
      success: true,
      message: 'Crawl started successfully (direct execution)',
      log_id: logId
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute direct crawl'
    console.error('[Cron API] Direct execution error:', errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * POSTメソッドもサポート（一部のcronサービスで使用）
 */
export async function POST(req: NextRequest) {
  return GET(req)
}

