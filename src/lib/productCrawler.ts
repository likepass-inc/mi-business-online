import * as cheerio from 'cheerio'
import { scrapePage } from './scraper'

const BASE_URL = 'https://business.mistore.jp'

/**
 * 商品URLを収集（サイトマップまたはカテゴリページから）
 */
export async function collectProductUrls(): Promise<string[]> {
  const urls: string[] = []
  
  // まずサイトマップから取得を試みる
  try {
    const sitemapUrls = await extractUrlsFromSitemap(`${BASE_URL}/sitemap.xml`)
    if (sitemapUrls.length > 0) {
      console.log(`Found ${sitemapUrls.length} product URLs from sitemap`)
      return sitemapUrls
    }
  } catch (error) {
    console.warn('Failed to extract URLs from sitemap, trying category pages:', error)
  }
  
  // サイトマップが取得できない場合はカテゴリページから取得
  try {
    const categoryUrls = await extractUrlsFromCategoryPages()
    if (categoryUrls.length > 0) {
      console.log(`Found ${categoryUrls.length} product URLs from category pages`)
      return categoryUrls
    }
  } catch (error) {
    console.error('Failed to extract URLs from category pages:', error)
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
      console.log(`Found ${sitemapUrls.length} sitemap files, processing...`)
      // 各sitemapを並列処理（最大10個まで）
      const batchSize = 10
      for (let i = 0; i < sitemapUrls.length; i += batchSize) {
        const batch = sitemapUrls.slice(i, i + batchSize)
        const results = await Promise.allSettled(
          batch.map(url => extractUrlsFromSitemap(url))
        )
        
        for (const result of results) {
          if (result.status === 'fulfilled') {
            for (const url of result.value) {
              if (!seenUrls.has(url)) {
                seenUrls.add(url)
                productUrls.push(url)
              }
            }
          }
        }
        
        // レート制限を考慮して少し待機
        if (i + batchSize < sitemapUrls.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }
    
    // urlset から直接URLを抽出
    let totalUrlsFound = 0
    const sampleUrls: string[] = []
    
    $('urlset > url > loc').each((_, el) => {
      const url = $(el).text().trim()
      totalUrlsFound++
      if (url) {
        // サンプルURLを保存（最初の5件）
        if (sampleUrls.length < 5) {
          sampleUrls.push(url)
        }
        if (isProductUrl(url) && !seenUrls.has(url)) {
          seenUrls.add(url)
          productUrls.push(url)
        }
      }
    })
    
    // 別のパターンも試す
    if (totalUrlsFound === 0) {
      $('url > loc').each((_, el) => {
        const url = $(el).text().trim()
        totalUrlsFound++
        if (url) {
          // サンプルURLを保存（最初の5件）
          if (sampleUrls.length < 5) {
            sampleUrls.push(url)
          }
          if (isProductUrl(url) && !seenUrls.has(url)) {
            seenUrls.add(url)
            productUrls.push(url)
          }
        }
      })
    }
    
    // デバッグ用：サンプルURLを表示
    if (sampleUrls.length > 0 && productUrls.length === 0) {
      console.log(`Sample URLs from sitemap (first 5):`, sampleUrls)
    }
    
    console.log(`Extracted ${productUrls.length} product URLs from sitemap (total URLs found: ${totalUrlsFound})`)
    
  } catch (error) {
    console.error('Error extracting URLs from sitemap:', error)
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
      $('a[href*="/shop/g/"]').each((_, el) => {
        const href = $(el).attr('href')
        if (href) {
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
    }
    
  } catch (error) {
    console.error(`Error extracting URLs from category page ${categoryUrl}:`, error)
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
  
  while (hasMore && page <= 100) { // 最大100ページまで
    try {
      const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`
      const urls = await extractUrlsFromCategoryPage(pageUrl)
      
      if (urls.length === 0) {
        consecutiveEmptyPages++
        // 連続して2ページ空なら終了
        if (consecutiveEmptyPages >= 2) {
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
      
      // 新しいURLがなければ終了
      if (newUrlsCount === 0 && urls.length === 0) {
        hasMore = false
        break
      }
      
      page++
      // レート制限を考慮（500ms待機）
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.warn(`Failed to extract URLs from page ${page} of ${baseUrl}:`, error)
      consecutiveEmptyPages++
      if (consecutiveEmptyPages >= 2) {
        hasMore = false
      } else {
        page++
      }
    }
  }
  
  return allUrls
}

/**
 * 複数のカテゴリページから商品URLを収集
 */
export async function extractUrlsFromCategoryPages(): Promise<string[]> {
  const allUrls: string[] = []
  const seenUrls = new Set<string>()
  
  // 主要なカテゴリページのURLパターン
  const categoryBaseUrls = [
    `${BASE_URL}/shop/c/`,
    `${BASE_URL}/shop/`,
  ]
  
  // カテゴリページのリストを取得（サイトマップまたは固定リスト）
  const categoryUrls: string[] = []
  
  // まず、カテゴリ一覧ページからカテゴリURLを取得
  try {
    const categoryListUrl = `${BASE_URL}/shop/`
    const response = await fetch(categoryListUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    })
    
    if (response.ok) {
      const html = await response.text()
      const $ = cheerio.load(html)
      
      // カテゴリリンクを探す（/shop/c/ で始まるリンク）
      $('a[href*="/shop/c/"]').each((_, el) => {
        const href = $(el).attr('href')
        if (href) {
          try {
            const url = new URL(href, BASE_URL).href
            // クエリパラメータを除去して正規化
            const normalizedUrl = url.split('?')[0]
            if (!categoryUrls.includes(normalizedUrl)) {
              categoryUrls.push(normalizedUrl)
            }
          } catch {
            // URL解析エラーは無視
          }
        }
      })
      
      console.log(`Found ${categoryUrls.length} category pages`)
    }
  } catch (error) {
    console.warn('Failed to fetch category list, using fallback method:', error)
  }
  
  // カテゴリページが取得できない場合は、直接商品ページを探す
  if (categoryUrls.length === 0) {
    // 商品一覧ページから直接商品URLを取得（ページネーション対応）
    try {
      const productListUrl = `${BASE_URL}/shop/`
      const urls = await extractUrlsFromCategoryPageWithPagination(productListUrl)
      for (const url of urls) {
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          allUrls.push(url)
        }
      }
    } catch (error) {
      console.error('Failed to extract URLs from product list page:', error)
    }
  } else {
    // 各カテゴリページから商品URLを取得（ページネーション対応、並列処理）
    const batchSize = 3 // 並列数を減らして安定性を向上
    for (let i = 0; i < categoryUrls.length; i += batchSize) {
      const batch = categoryUrls.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(url => extractUrlsFromCategoryPageWithPagination(url))
      )
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const url of result.value) {
            if (!seenUrls.has(url)) {
              seenUrls.add(url)
              allUrls.push(url)
            }
          }
        }
      }
      
      // レート制限を考慮して少し待機
      if (i + batchSize < categoryUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  
  return allUrls
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
    
    // ホスト名のチェック（business.mistore.jp またはそのサブドメイン）
    const isValidHost = urlObj.hostname.includes('business.mistore.jp') || 
                        urlObj.hostname.includes('mistore.jp')
    
    return productPattern.test(pathname) && isValidHost
  } catch {
    // URL解析エラーの場合は、文字列として直接チェック
    return /\/shop\/g\/[^\/]+/.test(url) && url.includes('mistore.jp')
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

