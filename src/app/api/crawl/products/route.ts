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

const MAX_CONCURRENT_REQUESTS = 5 // 並列リクエスト数の制限（3から5に増加）
const REQUEST_DELAY_MS = 300 // リクエスト間の待機時間（ミリ秒、500から300に短縮）

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
          // リトライロジック（最大3回まで）
          let lastError: Error | null = null
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              if (attempt > 0) {
                // リトライ時は待機時間を増やす（指数バックオフ）
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                console.log(`[Crawl API] Retrying ${url} (attempt ${attempt + 1}/3) after ${delay}ms`)
                await new Promise(resolve => setTimeout(resolve, delay))
              }
              
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
                  
                  // デバッグ: 最初の商品ページのHTMLをログに出力（エンコーディング確認用）
                  const isFirstProduct = i === 0 && batch.indexOf(url) === 0
                  if (isFirstProduct) {
                    console.log(`[Crawl API] Sample HTML (first 1000 chars) from ${url}:`, html.substring(0, 1000))
                    // タイトルタグの内容も確認
                    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
                    if (titleMatch) {
                      console.log(`[Crawl API] Title from HTML:`, titleMatch[1])
                    }
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
                
                // ArrayBufferとして取得
                const buffer = await response.arrayBuffer()
                
                // HTMLの最初の部分を読み取ってエンコーディングを確認
                const htmlStart = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 1024))
                
                // HTMLのmetaタグからcharsetを取得
                const metaCharsetMatch = htmlStart.match(/<meta[^>]*charset\s*=\s*["']?([^"'\s>]+)/i)
                const htmlCharset = metaCharsetMatch ? metaCharsetMatch[1].toLowerCase() : null
                
                // Content-Typeヘッダーからcharsetを取得
                const contentType = response.headers.get('content-type') || ''
                const headerCharsetMatch = contentType.match(/charset=([^;]+)/i)
                const headerCharset = headerCharsetMatch ? headerCharsetMatch[1].trim().toLowerCase() : null
                
                // エンコーディングを決定（HTMLのmetaタグ > Content-Typeヘッダー > デフォルトUTF-8）
                let charset = htmlCharset || headerCharset || 'utf-8'
                
                // エンコーディングの正規化
                if (charset === 'shift_jis' || charset === 'shift-jis' || charset === 'sjis') {
                  charset = 'shift-jis'
                } else if (charset === 'euc-jp' || charset === 'eucjp') {
                  charset = 'euc-jp'
                } else {
                  charset = 'utf-8'
                }
                
                // 適切なエンコーディングでデコード
                let decoder: TextDecoder
                try {
                  decoder = new TextDecoder(charset as any, { fatal: false })
                } catch {
                  // サポートされていないエンコーディングの場合はUTF-8を使用
                  decoder = new TextDecoder('utf-8', { fatal: false })
                }
                
                html = decoder.decode(buffer)
                
                // デバッグ: 最初の商品ページのエンコーディング情報をログに出力
                const isFirstProduct = i === 0 && batch.indexOf(url) === 0
                if (isFirstProduct) {
                  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
                  console.log(`[Crawl API] Encoding info for ${url}:`, {
                    htmlCharset,
                    headerCharset,
                    detectedCharset: charset,
                    titleFromHTML: titleMatch ? titleMatch[1].substring(0, 100) : 'not found',
                    htmlStart: html.substring(0, 200)
                  })
                }
              } catch (fetchError) {
                throw new Error(`Both Playwright and fetch failed: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}`)
              }
              
              // 商品情報をパース
              const productData = parseProductPage(html, url)
              
              if (productData) {
                return productData
              } else {
                throw new Error('Failed to parse product data')
              }
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error))
              
              // 最後の試行でない場合はリトライ
              if (attempt < 2) {
                continue
              }
              
              // 最後の試行でも失敗した場合はエラーをスロー
              console.error(`[Crawl API] Error crawling ${url} after ${attempt + 1} attempts:`, lastError)
              throw lastError
            }
          }
          
          // ここには到達しないはずだが、念のため
          throw lastError || new Error('Failed to crawl product')
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

