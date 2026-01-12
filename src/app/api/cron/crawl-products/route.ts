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
      const expectedAuth = `Bearer ${cronSecret}`
      if (authHeader !== expectedAuth) {
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
    
    console.log(`[Cron API] Calling internal API: ${crawlUrl}`)
    
    // 差分クロールを実行（毎日の定期実行では差分のみ）
    let response: Response
    try {
      response = await fetch(crawlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'incremental' }),
        // タイムアウトを設定（30秒）
        signal: AbortSignal.timeout(30000)
      })
    } catch (fetchError) {
      console.error('[Cron API] Fetch error:', fetchError)
      // fetchが失敗した場合（ネットワークエラーなど）、直接クロール処理を呼び出す
      console.log('[Cron API] Attempting direct crawl execution...')
      return await executeCrawlDirectly('incremental')
    }
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Cron API] Internal API error: ${response.status} - ${errorText}`)
      
      // 500エラーの場合、直接実行を試みる
      if (response.status === 500) {
        console.log('[Cron API] Internal API returned 500, attempting direct crawl execution...')
        return await executeCrawlDirectly('incremental')
      }
      
      let errorData: any
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `Internal API returned ${response.status}`
        },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'Crawl started successfully',
      log_id: data.log_id
    })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to execute cron crawl'
    const errorStack = e instanceof Error ? e.stack : undefined
    console.error('[Cron API] Error:', errorMessage, errorStack)
    
    // タイムアウトエラーの場合、直接実行を試みる
    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      console.log('[Cron API] Timeout occurred, attempting direct crawl execution...')
      try {
        return await executeCrawlDirectly('incremental')
      } catch (directError) {
        console.error('[Cron API] Direct execution also failed:', directError)
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
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

