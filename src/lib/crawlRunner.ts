/**
 * クロール実行ロジック（Crawl API と Cron API から共有）
 * 同プロセスで実行するため、Cron から呼んでも Render で確実にバックグラウンド実行される
 */
import { collectProductUrls } from '@/lib/productCrawler'
import { parseProductPage } from '@/lib/productParser'
import {
  updateCrawlLog,
  batchSaveProducts,
  getProductsNeedingUpdate
} from '@/lib/db/productRepository'
import type { ProductData } from '@/lib/db/productRepository'

const MAX_CONCURRENT_REQUESTS = 5
const REQUEST_DELAY_MS = 300
const LOG_PREFIX = '[CrawlRunner]'

export type CrawlType = 'full' | 'incremental'

export async function runCrawl(logId: number, crawlType: CrawlType): Promise<void> {
  let productUrls: string[] = []
  let successCount = 0
  let errorCount = 0

  try {
    if (crawlType === 'incremental') {
      const productsNeedingUpdate = getProductsNeedingUpdate(7)
      productUrls = productsNeedingUpdate.map(p => p.product_url)
      console.log(`${LOG_PREFIX} Incremental crawl: ${productUrls.length} products need update`)
    } else {
      productUrls = await collectProductUrls()
      console.log(`${LOG_PREFIX} Full crawl: ${productUrls.length} products found`)
    }

    updateCrawlLog(logId, { total_urls: productUrls.length })

    if (productUrls.length === 0) {
      updateCrawlLog(logId, {
        status: 'completed',
        completed_at: new Date(),
        success_count: 0,
        error_count: 0
      })
      return
    }

    const products: ProductData[] = []

    for (let i = 0; i < productUrls.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = productUrls.slice(i, i + MAX_CONCURRENT_REQUESTS)

      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          let lastError: Error | null = null
          let html = ''
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              if (attempt > 0) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                await new Promise(resolve => setTimeout(resolve, delay))
              }

              try {
                const { chromium } = await import('playwright')
                const browser = await chromium.launch({
                  headless: true,
                  args: ['--no-sandbox', '--disable-setuid-sandbox']
                })
                const page = await browser.newPage()
                try {
                  await page.setExtraHTTPHeaders({ 'Accept-Charset': 'UTF-8' })
                  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
                  html = await page.content()
                } finally {
                  await page.close().catch(() => {})
                  await browser.close().catch(() => {})
                }
              } catch (playwrightError) {
                try {
                  const response = await fetch(url, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Accept-Charset': 'UTF-8'
                    },
                    signal: AbortSignal.timeout(15000)
                  })
                  if (!response.ok) throw new Error(`HTTP ${response.status}`)
                  const buffer = await response.arrayBuffer()
                  const htmlStart = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 1024))
                  const metaCharsetMatch = htmlStart.match(/<meta[^>]*charset\s*=\s*["']?([^"'\s>]+)/i)
                  const htmlCharset = metaCharsetMatch ? metaCharsetMatch[1].toLowerCase() : null
                  const contentType = response.headers.get('content-type') || ''
                  const headerCharsetMatch = contentType.match(/charset=([^;]+)/i)
                  const headerCharset = headerCharsetMatch ? headerCharsetMatch[1].trim().toLowerCase() : null
                  let charset = htmlCharset || headerCharset || 'utf-8'
                  if (charset === 'shift_jis' || charset === 'shift-jis' || charset === 'sjis') charset = 'shift-jis'
                  else if (charset === 'euc-jp' || charset === 'eucjp') charset = 'euc-jp'
                  else charset = 'utf-8'
                  const decoder = new TextDecoder(charset as string, { fatal: false })
                  html = decoder.decode(buffer)
                } catch {
                  throw new Error(`Fetch fallback failed: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}`)
                }
              }

              const productData = parseProductPage(html, url)
              if (productData) return productData
              throw new Error('Failed to parse product data')
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error))
              if (attempt < 2) continue
              console.error(`${LOG_PREFIX} Error crawling ${url} after 3 attempts:`, lastError)
              throw lastError
            }
          }
          throw lastError || new Error('Failed to crawl product')
        })
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          products.push(result.value)
          successCount++
        } else {
          errorCount++
        }
      }

      updateCrawlLog(logId, { success_count: successCount, error_count: errorCount })

      if (i + MAX_CONCURRENT_REQUESTS < productUrls.length) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS))
      }
    }

    if (products.length > 0) {
      console.log(`${LOG_PREFIX} Saving ${products.length} products to database`)
      batchSaveProducts(products)
    }

    updateCrawlLog(logId, {
      status: 'completed',
      completed_at: new Date(),
      success_count: successCount,
      error_count: errorCount
    })
    console.log(`${LOG_PREFIX} Crawl completed: ${successCount} success, ${errorCount} errors`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Crawl failed:`, error)
    updateCrawlLog(logId, {
      status: 'failed',
      completed_at: new Date(),
      error_message: error instanceof Error ? error.message : String(error),
      success_count: successCount,
      error_count: errorCount
    })
  }
}
