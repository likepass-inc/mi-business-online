import { isSiteChromeProductName, parseProductPage } from './productParser'
import {
  createCrawlLog,
  updateCrawlLog,
  batchSaveProducts,
  seedSeasonMapProducts,
  clearSeasonMapPlaceholderAvailability,
  type ProductData,
} from './db/productRepository'
import {
  getSeasonMapEntries,
  getSeasonMapEntryForCode,
  getSeasonMapEntryForUrl,
  shopProductCode,
} from './seasonMap'

const MAX_CONCURRENT_REQUESTS = 5
const REQUEST_DELAY_MS = 200
const LOG_PREFIX = '[SeasonMapCrawl]'

async function fetchProductHtml(url: string): Promise<string> {
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

  const buffer = await response.arrayBuffer()
  const htmlStart = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 1024))
  const metaCharsetMatch = htmlStart.match(/<meta[^>]*charset\s*=\s*["']?([^"'\s>]+)/i)
  const htmlCharset = metaCharsetMatch ? metaCharsetMatch[1].toLowerCase() : null
  const contentType = response.headers.get('content-type') || ''
  const headerCharsetMatch = contentType.match(/charset=([^;]+)/i)
  const headerCharset = headerCharsetMatch ? headerCharsetMatch[1].trim().toLowerCase() : null
  let charset = htmlCharset || headerCharset || 'utf-8'
  if (charset === 'shift_jis' || charset === 'shift-jis' || charset === 'sjis') {
    charset = 'shift-jis'
  } else if (charset === 'euc-jp' || charset === 'eucjp') {
    charset = 'euc-jp'
  } else {
    charset = 'utf-8'
  }
  return new TextDecoder(charset, { fatal: false }).decode(buffer)
}

export function isSeasonMapStubProduct(product: ProductData): boolean {
  const name = (product.product_name || '').trim()
  const availability = product.availability || ''
  const discontinued = availability.includes('販売終了') || availability.includes('販売を終了')
  const hasCatalog =
    (product.price_incl_tax || 0) > 0 || (product.image_urls && product.image_urls.length > 0)
  return !name || isSiteChromeProductName(name) || (discontinued && !hasCatalog)
}

export function prepareSeasonMapProduct(product: ProductData, url: string): ProductData {
  const entry = getSeasonMapEntryForCode(product.product_code) || getSeasonMapEntryForUrl(url)
  if (!entry) {
    return product
  }
  if (isSeasonMapStubProduct(product)) {
    return {
      product_code: shopProductCode(entry.to),
      product_name: entry.to_name,
      product_url: entry.to_url || product.product_url || url,
    }
  }
  return {
    ...product,
    product_code: shopProductCode(entry.to),
    product_url: entry.to_url || product.product_url,
  }
}

export async function runSeasonMapCrawl(
  logId: number,
  options: { seedOnly?: boolean } = {}
): Promise<{ inserted: number; skipped: number; success_count: number; error_count: number }> {
  const seeded = seedSeasonMapProducts()
  const cleared = clearSeasonMapPlaceholderAvailability()
  console.log(
    `${LOG_PREFIX} Seeded FW products: inserted=${seeded.inserted} skipped=${seeded.skipped} cleared_placeholders=${cleared}`
  )

  if (options.seedOnly) {
    const clearedOnly = clearSeasonMapPlaceholderAvailability()
    updateCrawlLog(logId, {
      status: 'completed',
      completed_at: new Date(),
      total_urls: 0,
      success_count: seeded.inserted,
      error_count: 0,
    })
    console.log(`${LOG_PREFIX} seed_only cleared_placeholders=${clearedOnly}`)
    return { ...seeded, success_count: 0, error_count: 0 }
  }

  const urls = getSeasonMapEntries().map((entry) => entry.to_url).filter(Boolean)
  updateCrawlLog(logId, { total_urls: urls.length })

  let successCount = 0
  let errorCount = 0
  const products: ProductData[] = []

  for (let i = 0; i < urls.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = urls.slice(i, i + MAX_CONCURRENT_REQUESTS)
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        let lastError: Error | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt > 0) {
              await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 4000)))
            }
            const html = await fetchProductHtml(url)
            const parsed = parseProductPage(html, url)
            if (!parsed) {
              throw new Error('Failed to parse product data')
            }
            return prepareSeasonMapProduct(parsed, url)
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
          }
        }
        throw lastError || new Error(`Failed to crawl ${url}`)
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        products.push(result.value)
        successCount += 1
      } else {
        errorCount += 1
        console.error(`${LOG_PREFIX} ${result.reason}`)
      }
    }

    updateCrawlLog(logId, { success_count: successCount, error_count: errorCount })

    if (i + MAX_CONCURRENT_REQUESTS < urls.length) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
    }
  }

  if (products.length > 0) {
    batchSaveProducts(products)
    clearSeasonMapPlaceholderAvailability()
  }

  updateCrawlLog(logId, {
    status: 'completed',
    completed_at: new Date(),
    success_count: successCount,
    error_count: errorCount,
  })
  console.log(`${LOG_PREFIX} Completed: ${successCount} success, ${errorCount} errors`)
  return { ...seeded, success_count: successCount, error_count: errorCount }
}

export async function startSeasonMapCrawl(options: { seedOnly?: boolean } = {}): Promise<number> {
  const logId = createCrawlLog('season-map')
  runSeasonMapCrawl(logId, options).catch((error) => {
    console.error(`${LOG_PREFIX} Background crawl failed:`, error)
    updateCrawlLog(logId, {
      status: 'failed',
      completed_at: new Date(),
      error_message: error instanceof Error ? error.message : String(error),
    })
  })
  return logId
}
