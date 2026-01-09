import { NextRequest, NextResponse } from 'next/server'
import { collectProductUrls } from '@/lib/productCrawler'
import { scrapePage } from '@/lib/scraper'
import { parseProductPage } from '@/lib/productParser'
import {
  createCrawlLog,
  updateCrawlLog,
  batchSaveProducts,
  getProductsNeedingUpdate
} from '@/lib/db/productRepository'
import type { ProductData } from '@/lib/db/productRepository'

const MAX_CONCURRENT_REQUESTS = 3 // 並列リクエスト数の制限
const REQUEST_DELAY_MS = 500 // リクエスト間の待機時間（ミリ秒）

/**
 * 全商品のクロールを実行
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const crawlType = body.type === 'incremental' ? 'incremental' : 'full'
    
    console.log(`[Crawl API] Starting ${crawlType} crawl`)
    
    // クロールログを作成
    const logId = createCrawlLog(crawlType)
    
    // 非同期でクロールを実行（レスポンスを先に返す）
    executeCrawl(logId, crawlType).catch(error => {
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

/**
 * クロールを実行（非同期）
 */
async function executeCrawl(logId: number, crawlType: 'full' | 'incremental') {
  let productUrls: string[] = []
  let successCount = 0
  let errorCount = 0
  
  try {
    // 商品URLを収集
    if (crawlType === 'incremental') {
      // 差分クロール：更新が必要な商品のみ
      const productsNeedingUpdate = getProductsNeedingUpdate(7) // 7日以上更新されていない商品
      productUrls = productsNeedingUpdate.map(p => p.product_url)
      console.log(`[Crawl API] Incremental crawl: ${productUrls.length} products need update`)
    } else {
      // フルクロール：全商品
      productUrls = await collectProductUrls()
      console.log(`[Crawl API] Full crawl: ${productUrls.length} products found`)
    }
    
    updateCrawlLog(logId, {
      total_urls: productUrls.length
    })
    
    if (productUrls.length === 0) {
      updateCrawlLog(logId, {
        status: 'completed',
        completed_at: new Date(),
        success_count: 0,
        error_count: 0
      })
      return
    }
    
    // バッチ処理で商品をスクレイピング
    const products: ProductData[] = []
    
    for (let i = 0; i < productUrls.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = productUrls.slice(i, i + MAX_CONCURRENT_REQUESTS)
      
      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            // スクレイピング
            const scrapedData = await scrapePage(url, false)
            
            // HTMLを取得（文字エンコーディングを正しく処理するため、Playwrightを優先使用）
            let html: string
            try {
              // Playwrightを使用してHTMLを取得（エンコーディングを自動処理）
              const { chromium } = await import('playwright')
              const browser = await chromium.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
              })
              const page = await browser.newPage()
              try {
                // ページのエンコーディングを明示的にUTF-8に設定
                await page.setExtraHTTPHeaders({
                  'Accept-Charset': 'UTF-8'
                })
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
                // ページのコンテンツをUTF-8として取得
                html = await page.content()
                
                // デバッグ: 最初の500文字をログに出力（エンコーディング確認用）
                if (i === 0) {
                  console.log(`[Crawl API] Sample HTML (first 500 chars):`, html.substring(0, 500))
                }
              } finally {
                await page.close().catch(() => {})
                await browser.close().catch(() => {})
              }
            } catch (playwrightError) {
              // Playwrightが失敗した場合、fetchを使用して再試行
              console.warn(`[Crawl API] Playwright failed for ${url}, trying fetch:`, playwrightError)
              try {
                const response = await fetch(url, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Charset': 'UTF-8',
                  },
                  signal: AbortSignal.timeout(15000),
                })
                
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }
                
                // レスポンスのエンコーディングを確認
                const contentType = response.headers.get('content-type') || ''
                const charsetMatch = contentType.match(/charset=([^;]+)/i)
                const charset = charsetMatch ? charsetMatch[1].trim() : 'utf-8'
                
                // ArrayBufferとして取得してから、適切なエンコーディングでデコード
                const buffer = await response.arrayBuffer()
                const decoder = new TextDecoder(charset.toLowerCase() === 'utf-8' ? 'utf-8' : 'utf-8')
                html = decoder.decode(buffer)
              } catch (fetchError) {
                throw new Error(`Both Playwright and fetch failed: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}`)
              }
            }
            
            // 商品情報をパース
            const productData = parseProductPage(html, url)
            
            if (productData) {
              return productData
            } else {
              throw new Error('Failed to parse product data')
            }
          } catch (error) {
            console.error(`[Crawl API] Error crawling ${url}:`, error)
            throw error
          }
        })
      )
      
      // 結果を処理
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          products.push(result.value)
          successCount++
        } else {
          errorCount++
        }
      }
      
      // 進捗を更新
      updateCrawlLog(logId, {
        success_count: successCount,
        error_count: errorCount
      })
      
      // レート制限を考慮して待機
      if (i + MAX_CONCURRENT_REQUESTS < productUrls.length) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS))
      }
    }
    
    // データベースに保存
    if (products.length > 0) {
      console.log(`[Crawl API] Saving ${products.length} products to database`)
      batchSaveProducts(products)
    }
    
    // クロールログを完了
    updateCrawlLog(logId, {
      status: 'completed',
      completed_at: new Date(),
      success_count: successCount,
      error_count: errorCount
    })
    
    console.log(`[Crawl API] Crawl completed: ${successCount} success, ${errorCount} errors`)
    
  } catch (error) {
    console.error(`[Crawl API] Crawl execution failed:`, error)
    updateCrawlLog(logId, {
      status: 'failed',
      completed_at: new Date(),
      error_message: error instanceof Error ? error.message : String(error),
      success_count: successCount,
      error_count: errorCount
    })
  }
}

