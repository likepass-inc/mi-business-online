import * as cheerio from 'cheerio'
import { scrapePage } from './scraper'

const BASE_URL = 'https://business.mistore.jp'

/**
 * 商品URLを収集（カテゴリページを優先、サイトマップは補助的に使用）
 * 
 * 注意: サイトマップが古いドメイン（kinogift.jp）を含んでいるため、
 * カテゴリページからの収集を優先し、サイトマップは補助的な手段として使用します。
 */
export async function collectProductUrls(): Promise<string[]> {
  const urls: string[] = []
  const seenUrls = new Set<string>()
  
  console.log('[Collection] Starting product URL collection (category pages prioritized)')
  
  // 1. カテゴリページから商品URLを収集（優先）
  console.log('[Collection] Step 1: Collecting from category pages...')
  try {
    const categoryUrls = await extractUrlsFromCategoryPages()
    if (categoryUrls.length > 0) {
      console.log(`[Collection] Found ${categoryUrls.length} product URLs from category pages`)
      for (const url of categoryUrls) {
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          urls.push(url)
        }
      }
      console.log(`[Collection] Total unique URLs after category collection: ${urls.length}`)
    } else {
      console.warn('[Collection] No product URLs found from category pages')
    }
  } catch (error) {
    console.error('[Collection] Failed to extract URLs from category pages:', error instanceof Error ? error.message : String(error))
  }
  
  // 2. サイトマップからも収集を試みる（補助的、正規化済み）
  // 注意: サイトマップは古いドメインを含む可能性があるため、正規化が必要
  console.log('[Collection] Step 2: Collecting from sitemaps (supplementary)...')
  const sitemapUrlsToTry = [
    `${BASE_URL}/sitemap.xml`,
    `${BASE_URL}/sitemap_index.xml`,
    `${BASE_URL}/sitemaps/sitemap.xml`,
    `${BASE_URL}/robots.txt`, // robots.txtからサイトマップの場所を取得
  ]
  
  let sitemapUrlsFound = 0
  for (const sitemapUrl of sitemapUrlsToTry) {
    try {
      console.log(`[Sitemap] Trying sitemap URL: ${sitemapUrl}`)
      const sitemapUrls = await extractUrlsFromSitemap(sitemapUrl)
      if (sitemapUrls.length > 0) {
        console.log(`[Sitemap] Found ${sitemapUrls.length} product URLs from sitemap: ${sitemapUrl}`)
        sitemapUrlsFound += sitemapUrls.length
        // 重複を排除してマージ（正規化済みのURLが含まれる）
        for (const url of sitemapUrls) {
          if (!seenUrls.has(url)) {
            seenUrls.add(url)
            urls.push(url)
          }
        }
        console.log(`[Sitemap] Merged ${sitemapUrls.length} URLs from sitemap (total: ${urls.length})`)
      }
    } catch (error) {
      console.warn(`[Sitemap] Failed to extract URLs from sitemap ${sitemapUrl}:`, error instanceof Error ? error.message : String(error))
      continue
    }
  }
  
  if (sitemapUrlsFound > 0) {
    console.log(`[Sitemap] Total ${sitemapUrlsFound} product URLs found in sitemaps (${urls.length - (urls.length - sitemapUrlsFound)} new URLs added)`)
  } else {
    console.log('[Sitemap] No product URLs found in sitemaps (this is expected if sitemap is outdated)')
  }
  
  if (urls.length === 0) {
    console.error('[Collection] WARNING: No product URLs collected from any source!')
  } else {
    console.log(`[Collection] SUCCESS: Collected ${urls.length} total unique product URLs`)
    console.log(`[Collection]   - From category pages: ${urls.length - sitemapUrlsFound}`)
    console.log(`[Collection]   - From sitemaps: ${sitemapUrlsFound}`)
  }
  
  return urls
}

/**
 * サイトマップXMLから商品URLを抽出
 */
export async function extractUrlsFromSitemap(sitemapUrl: string): Promise<string[]> {
  const productUrls: string[] = []
  const seenUrls = new Set<string>()
  
  try {
    // robots.txtの場合は、まずrobots.txtをパースしてサイトマップの場所を取得
    if (sitemapUrl.endsWith('/robots.txt')) {
      console.log(`[Sitemap] Fetching robots.txt to find sitemap locations`)
      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      })
      
      if (response.ok) {
        const text = await response.text()
        const sitemapLines = text.split('\n').filter(line => 
          line.trim().toLowerCase().startsWith('sitemap:')
        )
        
        if (sitemapLines.length > 0) {
          console.log(`[Sitemap] Found ${sitemapLines.length} sitemap references in robots.txt`)
          const sitemapUrlsFromRobots = sitemapLines.map(line => {
            const url = line.split(':').slice(1).join(':').trim()
            return url
          }).filter(url => url.includes('business.mistore.jp') || url.includes('mistore.jp'))
          
          // robots.txtから見つかったサイトマップを再帰的に処理
          for (const url of sitemapUrlsFromRobots) {
            try {
              const urls = await extractUrlsFromSitemap(url)
              for (const productUrl of urls) {
                if (!seenUrls.has(productUrl)) {
                  seenUrls.add(productUrl)
                  productUrls.push(productUrl)
                }
              }
            } catch (error) {
              console.warn(`[Sitemap] Failed to process sitemap from robots.txt: ${url}`, error instanceof Error ? error.message : String(error))
            }
          }
          
          if (productUrls.length > 0) {
            console.log(`[Sitemap] Collected ${productUrls.length} product URLs from robots.txt sitemaps`)
            return productUrls
          }
        }
      }
      return []
    }
    
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(30000), // タイムアウトを30秒に延長
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status}`)
    }
    
    const xml = await response.text()
    const $ = cheerio.load(xml, { xmlMode: true })
    
    console.log(`[Sitemap] Processing sitemap: ${sitemapUrl} (${xml.length} chars)`)
    
    // sitemapindex の場合、各sitemapを再帰的に処理
    const sitemapUrls: string[] = []
    $('sitemapindex > sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim()
      if (loc) {
        sitemapUrls.push(loc)
      }
    })
    
    // 別のパターンも試す
    if (sitemapUrls.length === 0) {
      $('sitemap > loc').each((_, el) => {
        const loc = $(el).text().trim()
        if (loc) {
          sitemapUrls.push(loc)
        }
      })
    }
    
    if (sitemapUrls.length > 0) {
      console.log(`[Sitemap] Found ${sitemapUrls.length} sitemap files in index, processing recursively...`)
      // 各sitemapを並列処理（最大10個まで）
      const batchSize = 10
      for (let i = 0; i < sitemapUrls.length; i += batchSize) {
        const batch = sitemapUrls.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(sitemapUrls.length / batchSize)
        console.log(`[Sitemap] Processing sitemap batch ${batchNumber}/${totalBatches} (${batch.length} sitemaps)...`)
        
        const results = await Promise.allSettled(
          batch.map(url => extractUrlsFromSitemap(url))
        )
        
        let batchProductCount = 0
        for (const result of results) {
          if (result.status === 'fulfilled') {
            for (const url of result.value) {
              if (!seenUrls.has(url)) {
                seenUrls.add(url)
                productUrls.push(url)
                batchProductCount++
              }
            }
          } else {
            console.warn(`[Sitemap] Failed to process sitemap in batch:`, result.reason)
          }
        }
        
        console.log(`[Sitemap] Batch ${batchNumber}/${totalBatches} completed: ${batchProductCount} new product URLs found (total: ${productUrls.length})`)
        
        // レート制限を考慮して少し待機
        if (i + batchSize < sitemapUrls.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      if (productUrls.length > 0) {
        console.log(`[Sitemap] Total ${productUrls.length} product URLs collected from sitemap index`)
        return productUrls
      }
    }
    
    // urlset から直接URLを抽出
    let totalUrlsFound = 0
    let businessMistoreUrls = 0
    let shopGUrls = 0
    const sampleUrls: string[] = []
    const sampleBusinessUrls: string[] = []
    const sampleShopGUrls: string[] = []
    
    // パターン1: urlset > url > loc
    $('urlset > url > loc').each((_, el) => {
      const url = $(el).text().trim()
      totalUrlsFound++
      if (url) {
        // business.mistore.jpのURLをカウント
        if (url.includes('business.mistore.jp')) {
          businessMistoreUrls++
          // business.mistore.jpのサンプルURLを保存（最初の10件）
          if (sampleBusinessUrls.length < 10) {
            sampleBusinessUrls.push(url)
          }
        }
        // /shop/g/ パターンのURLを優先的に収集
        if (url.includes('/shop/g/')) {
          shopGUrls++
          if (sampleShopGUrls.length < 10) {
            sampleShopGUrls.push(url)
          }
        }
        // 全URLのサンプルを保存（最初の5件）
        if (sampleUrls.length < 5) {
          sampleUrls.push(url)
        }
        if (isProductUrl(url)) {
          // kinogift.jpのURLをbusiness.mistore.jpに正規化
          const normalizedUrl = normalizeProductUrl(url)
          if (!seenUrls.has(normalizedUrl)) {
            seenUrls.add(normalizedUrl)
            productUrls.push(normalizedUrl)
          }
        }
      }
    })
    
    // パターン2: url > loc（urlsetがない場合）
    if (totalUrlsFound === 0) {
      $('url > loc').each((_, el) => {
        const url = $(el).text().trim()
        totalUrlsFound++
        if (url) {
          // business.mistore.jpのURLをカウント
          if (url.includes('business.mistore.jp')) {
            businessMistoreUrls++
            // business.mistore.jpのサンプルURLを保存（最初の10件）
            if (sampleBusinessUrls.length < 10) {
              sampleBusinessUrls.push(url)
            }
          }
          // /shop/g/ パターンのURLを優先的に収集
          if (url.includes('/shop/g/')) {
            shopGUrls++
            if (sampleShopGUrls.length < 10) {
              sampleShopGUrls.push(url)
            }
          }
          // 全URLのサンプルを保存（最初の5件）
          if (sampleUrls.length < 5) {
            sampleUrls.push(url)
          }
          if (isProductUrl(url)) {
            // kinogift.jpのURLをbusiness.mistore.jpに正規化
            const normalizedUrl = normalizeProductUrl(url)
            if (!seenUrls.has(normalizedUrl)) {
              seenUrls.add(normalizedUrl)
              productUrls.push(normalizedUrl)
            }
          }
        }
      })
    }
    
    // デバッグ用：サンプルURLを表示
    let kinogiftUrls = 0
    const sampleKinogiftUrls: string[] = []
    
    // kinogift.jpのURLもカウント
    $('urlset > url > loc, url > loc').each((_, el) => {
      const url = $(el).text().trim()
      if (url && url.includes('kinogift.jp') && url.includes('/shop/g/')) {
        kinogiftUrls++
        if (sampleKinogiftUrls.length < 10) {
          sampleKinogiftUrls.push(url)
        }
      }
    })
    
    console.log(`[Sitemap] Analysis for ${sitemapUrl}:`)
    console.log(`[Sitemap]   - Total URLs found: ${totalUrlsFound}`)
    console.log(`[Sitemap]   - business.mistore.jp URLs: ${businessMistoreUrls}`)
    console.log(`[Sitemap]   - kinogift.jp /shop/g/ URLs: ${kinogiftUrls}`)
    console.log(`[Sitemap]   - /shop/g/ URLs (total): ${shopGUrls}`)
    console.log(`[Sitemap]   - Product URLs extracted: ${productUrls.length}`)
    
    if (sampleKinogiftUrls.length > 0) {
      console.log(`[Sitemap] Sample kinogift.jp /shop/g/ URLs (first 10):`, sampleKinogiftUrls)
      console.log(`[Sitemap] These will be normalized to business.mistore.jp`)
    } else if (sampleShopGUrls.length > 0) {
      console.log(`[Sitemap] Sample /shop/g/ URLs (first 10):`, sampleShopGUrls)
    } else if (sampleBusinessUrls.length > 0) {
      console.log(`[Sitemap] Sample business.mistore.jp URLs (first 10):`, sampleBusinessUrls)
    } else if (sampleUrls.length > 0) {
      console.log(`[Sitemap] Sample URLs from sitemap (first 5):`, sampleUrls)
    }
    
  } catch (error) {
    console.error(`[Sitemap] Error extracting URLs from sitemap ${sitemapUrl}:`, error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error(`[Sitemap] Stack trace:`, error.stack)
    }
    // エラーが発生しても、これまでに収集したURLは返す
    if (productUrls.length > 0) {
      console.log(`[Sitemap] Returning ${productUrls.length} product URLs collected before error`)
      return productUrls
    }
    throw error
  }
  
  return productUrls
}

/**
 * カテゴリページから商品URLを抽出（1ページ分）
 */
export async function extractUrlsFromCategoryPage(categoryUrl: string): Promise<string[]> {
  const productUrls: string[] = []
  const seenUrls = new Set<string>()
  
  try {
    // HTMLを直接パースして商品リンクを探す
    const response = await fetch(categoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    })
    
    if (response.ok) {
      const html = await response.text()
      const $ = cheerio.load(html)
      
      // 商品リンクを探す（/shop/g/ で始まるリンク）
      let linkCount = 0
      $('a[href*="/shop/g/"]').each((_, el) => {
        const href = $(el).attr('href')
        if (href) {
          linkCount++
          try {
            const url = new URL(href, BASE_URL).href
            const normalizedUrl = url.split('?')[0] // クエリパラメータを除去
            if (isProductUrl(normalizedUrl) && !seenUrls.has(normalizedUrl)) {
              seenUrls.add(normalizedUrl)
              productUrls.push(normalizedUrl)
            }
          } catch {
            // URL解析エラーは無視
          }
        }
      })
      
      if (productUrls.length > 0) {
        console.log(`[Category] Extracted ${productUrls.length} product URLs from ${categoryUrl} (found ${linkCount} /shop/g/ links)`)
      }
    } else {
      console.warn(`[Category] Failed to fetch category page ${categoryUrl}: HTTP ${response.status}`)
    }
    
  } catch (error) {
    console.error(`[Category] Error extracting URLs from category page ${categoryUrl}:`, error instanceof Error ? error.message : String(error))
  }
  
  return productUrls
}

/**
 * ページネーションを考慮してカテゴリページから商品URLを収集
 */
async function extractUrlsFromCategoryPageWithPagination(categoryUrl: string): Promise<string[]> {
  const allUrls: string[] = []
  const seenUrls = new Set<string>()
  let page = 1
  let hasMore = true
  let consecutiveEmptyPages = 0
  
  // URLからクエリパラメータを除去して正規化
  const baseUrl = categoryUrl.split('?')[0]
  
  // タイムアウトを設定（カテゴリごとに最大120秒）
  const startTime = Date.now()
  const maxDuration = 120000 // 120秒に延長
  
  console.log(`[Category] Starting pagination crawl for ${baseUrl} (max ${maxDuration/1000}s, max 200 pages)`)
  
  while (hasMore && page <= 200) { // 最大200ページまで
    // タイムアウトチェック
    const elapsed = Date.now() - startTime
    if (elapsed > maxDuration) {
      console.warn(`[Category] Timeout reached for ${baseUrl} after ${page} pages (${Math.round(elapsed/1000)}s), collected ${allUrls.length} URLs`)
      break
    }
    
    try {
      const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`
      if (page % 10 === 0 || page === 1) {
        console.log(`[Category] Processing page ${page} of ${baseUrl}... (${allUrls.length} URLs collected so far)`)
      }
      const urls = await extractUrlsFromCategoryPage(pageUrl)
      
      if (urls.length === 0) {
        consecutiveEmptyPages++
        // 連続して3ページ空なら終了（2ページから3ページに変更）
        if (consecutiveEmptyPages >= 3) {
          console.log(`[Category] Stopping pagination for ${baseUrl}: ${consecutiveEmptyPages} consecutive empty pages`)
          hasMore = false
          break
        }
      } else {
        consecutiveEmptyPages = 0
      }
      
      let newUrlsCount = 0
      for (const url of urls) {
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          allUrls.push(url)
          newUrlsCount++
        }
      }
      
      if (newUrlsCount > 0) {
        console.log(`[Category] Page ${page} of ${baseUrl}: Found ${newUrlsCount} new URLs (total: ${allUrls.length})`)
      }
      
      // 新しいURLがなければ終了
      if (newUrlsCount === 0 && urls.length === 0) {
        console.log(`[Category] No new URLs found on page ${page} of ${baseUrl}, stopping pagination`)
        hasMore = false
        break
      }
      
      page++
      // レート制限を考慮（200ms待機）
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      console.warn(`[Category] Failed to extract URLs from page ${page} of ${baseUrl}:`, error instanceof Error ? error.message : String(error))
      consecutiveEmptyPages++
      if (consecutiveEmptyPages >= 3) {
        console.log(`[Category] Stopping pagination due to errors: ${consecutiveEmptyPages} consecutive failures`)
        hasMore = false
      } else {
        page++
      }
    }
  }
  
  console.log(`[Category] Completed pagination crawl for ${baseUrl}: ${allUrls.length} URLs collected from ${page} pages`)
  return allUrls
}

/**
 * 複数のカテゴリページから商品URLを収集
 * 
 * サイトマップが古いため、実際のサイト構造から商品URLを収集します。
 * 1. カテゴリ一覧ページからカテゴリURLを発見
 * 2. 各カテゴリページから商品URLを収集（ページネーション対応）
 * 3. メインの /shop/ ページからも直接商品を収集（補完的）
 */
export async function extractUrlsFromCategoryPages(): Promise<string[]> {
  const allUrls: string[] = []
  const seenUrls = new Set<string>()
  
  // カテゴリページのリストを取得
  const categoryUrls: string[] = []
  
  // 1. カテゴリ一覧ページからカテゴリURLを取得
  const categoryListUrls = [
    `${BASE_URL}/shop/`,
    `${BASE_URL}/shop/c/`,
  ]
  
  for (const categoryListUrl of categoryListUrls) {
    try {
      console.log(`[Category] Fetching category list from ${categoryListUrl}`)
      const response = await fetch(categoryListUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      })
      
      if (response.ok) {
        const html = await response.text()
        const $ = cheerio.load(html)
        
        // カテゴリリンクを探す（/shop/c/ で始まるリンク）
        let foundInThisPage = 0
        $('a[href*="/shop/c/"]').each((_, el) => {
          const href = $(el).attr('href')
          if (href) {
            try {
              const url = new URL(href, BASE_URL).href
              // クエリパラメータを除去して正規化
              const normalizedUrl = url.split('?')[0]
              if (!categoryUrls.includes(normalizedUrl)) {
                categoryUrls.push(normalizedUrl)
                foundInThisPage++
              }
            } catch {
              // URL解析エラーは無視
            }
          }
        })
        
        console.log(`[Category] Found ${foundInThisPage} new category pages from ${categoryListUrl} (total: ${categoryUrls.length})`)
      }
    } catch (error) {
      console.warn(`[Category] Failed to fetch category list from ${categoryListUrl}:`, error instanceof Error ? error.message : String(error))
    }
  }
  
  console.log(`[Category] Total ${categoryUrls.length} category pages found`)
  
  // 2. メインの /shop/ ページからも直接商品を収集（並行して実行）
  console.log(`[Category] Also collecting products from main /shop/ page...`)
  const mainShopPagePromise = (async () => {
    try {
      const productListUrl = `${BASE_URL}/shop/`
      const urls = await extractUrlsFromCategoryPageWithPagination(productListUrl)
      console.log(`[Category] Found ${urls.length} products from main /shop/ page`)
      return urls
    } catch (error) {
      console.warn(`[Category] Failed to extract URLs from main /shop/ page:`, error instanceof Error ? error.message : String(error))
      return []
    }
  })()
  
  // 3. 各カテゴリページから商品URLを取得（ページネーション対応、並列処理）
  if (categoryUrls.length > 0) {
    const batchSize = 3 // 並列数を3に減らしてタイムアウトを避ける（各カテゴリが120秒までかかる可能性があるため）
    console.log(`[Category] Processing ${categoryUrls.length} category pages in batches of ${batchSize}...`)
    
    for (let i = 0; i < categoryUrls.length; i += batchSize) {
      const batch = categoryUrls.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(categoryUrls.length / batchSize)
      
      console.log(`[Category] Processing batch ${batchNumber}/${totalBatches} (${batch.length} categories)...`)
      
      const batchStartTime = Date.now()
      const results = await Promise.allSettled(
        batch.map(async (url, idx) => {
          try {
            const urls = await extractUrlsFromCategoryPageWithPagination(url)
            console.log(`[Category] Category ${i + idx + 1}/${categoryUrls.length}: Found ${urls.length} products from ${url}`)
            return urls
          } catch (error) {
            console.error(`[Category] Failed to extract URLs from category ${url}:`, error instanceof Error ? error.message : String(error))
            return []
          }
        })
      )
      
      let batchTotalUrls = 0
      let batchSuccessCount = 0
      for (const result of results) {
        if (result.status === 'fulfilled') {
          batchSuccessCount++
          for (const url of result.value) {
            if (!seenUrls.has(url)) {
              seenUrls.add(url)
              allUrls.push(url)
              batchTotalUrls++
            }
          }
        } else {
          console.warn(`[Category] Batch item failed:`, result.reason)
        }
      }
      
      const batchDuration = Math.round((Date.now() - batchStartTime) / 1000)
      console.log(`[Category] Batch ${batchNumber}/${totalBatches} completed: ${batchTotalUrls} new URLs found (${batchSuccessCount}/${batch.length} categories succeeded, ${batchDuration}s, total: ${allUrls.length})`)
      
      // レート制限を考慮して少し待機
      if (i + batchSize < categoryUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  
  // 4. メインの /shop/ ページから収集したURLをマージ
  try {
    const mainShopUrls = await mainShopPagePromise
    let mainShopNewUrls = 0
    for (const url of mainShopUrls) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url)
        allUrls.push(url)
        mainShopNewUrls++
      }
    }
    if (mainShopNewUrls > 0) {
      console.log(`[Category] Merged ${mainShopNewUrls} new URLs from main /shop/ page (total: ${allUrls.length})`)
    }
  } catch (error) {
    console.warn(`[Category] Failed to merge URLs from main /shop/ page:`, error instanceof Error ? error.message : String(error))
  }
  
  console.log(`[Category] Total product URLs collected from category pages: ${allUrls.length}`)
  return allUrls
}

/**
 * URLをbusiness.mistore.jpに正規化（kinogift.jpのURLを変換）
 */
function normalizeProductUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // kinogift.jpのURLをbusiness.mistore.jpに変換
    if (urlObj.hostname.includes('kinogift.jp')) {
      urlObj.hostname = 'business.mistore.jp'
      // httpをhttpsに変換
      if (urlObj.protocol === 'http:') {
        urlObj.protocol = 'https:'
      }
      return urlObj.href
    }
    return url
  } catch {
    // URL解析エラーの場合は、文字列として直接変換
    return url.replace(/https?:\/\/kinogift\.jp/, 'https://business.mistore.jp')
  }
}

/**
 * URLが商品ページかどうかを判定
 */
function isProductUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    
    // /shop/g/ で始まるパスが商品ページ
    // パターン1: /shop/g/商品コード
    // パターン2: /shop/g/商品コード/...
    const productPattern = /^\/shop\/g\/[^\/]+/
    
    // ホスト名のチェック（business.mistore.jp、kinogift.jp、またはそのサブドメイン）
    const isValidHost = urlObj.hostname.includes('business.mistore.jp') || 
                        urlObj.hostname.includes('kinogift.jp') ||
                        urlObj.hostname.includes('mistore.jp')
    
    return productPattern.test(pathname) && isValidHost
  } catch {
    // URL解析エラーの場合は、文字列として直接チェック
    return /\/shop\/g\/[^\/]+/.test(url) && (url.includes('mistore.jp') || url.includes('kinogift.jp'))
  }
}

/**
 * 商品コードをURLから抽出
 */
export function extractProductCodeFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const match = urlObj.pathname.match(/^\/shop\/g\/([^\/\?]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

