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
  
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status}`)
    }
    
    const xml = await response.text()
    const $ = cheerio.load(xml, { xmlMode: true })
    
    // sitemapindex の場合、各sitemapを再帰的に処理
    $('sitemapindex > sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim()
      if (loc) {
        // 再帰的に処理（ただし無限ループを防ぐため、sitemap.xmlのみ）
        if (loc.includes('sitemap') && loc.endsWith('.xml')) {
          // 非同期処理のため、ここでは収集のみ
          // 実際の実装では、Promise.all で並列処理するか、順次処理する
        }
      }
    })
    
    // urlset から直接URLを抽出
    $('urlset > url > loc').each((_, el) => {
      const url = $(el).text().trim()
      if (url && isProductUrl(url)) {
        productUrls.push(url)
      }
    })
    
  } catch (error) {
    console.error('Error extracting URLs from sitemap:', error)
    throw error
  }
  
  return productUrls
}

/**
 * カテゴリページから商品URLを抽出
 */
export async function extractUrlsFromCategoryPage(categoryUrl: string): Promise<string[]> {
  const productUrls: string[] = []
  
  try {
    // 既存のスクレイピング機能を使用
    const scrapedData = await scrapePage(categoryUrl, false)
    
    if (scrapedData.internalLinks) {
      for (const link of scrapedData.internalLinks) {
        if (isProductUrl(link)) {
          productUrls.push(link)
        }
      }
    }
    
    // HTMLを直接パースして商品リンクを探す
    const response = await fetch(categoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
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
            if (isProductUrl(url) && !productUrls.includes(url)) {
              productUrls.push(url)
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
            if (!categoryUrls.includes(url)) {
              categoryUrls.push(url)
            }
          } catch {
            // URL解析エラーは無視
          }
        }
      })
    }
  } catch (error) {
    console.warn('Failed to fetch category list, using fallback method:', error)
  }
  
  // カテゴリページが取得できない場合は、直接商品ページを探す
  if (categoryUrls.length === 0) {
    // 商品一覧ページから直接商品URLを取得
    try {
      const productListUrl = `${BASE_URL}/shop/`
      const urls = await extractUrlsFromCategoryPage(productListUrl)
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
    // 各カテゴリページから商品URLを取得（並列処理、最大5つまで）
    const batchSize = 5
    for (let i = 0; i < categoryUrls.length; i += batchSize) {
      const batch = categoryUrls.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(url => extractUrlsFromCategoryPage(url))
      )
      
      for (const urls of results) {
        for (const url of urls) {
          if (!seenUrls.has(url)) {
            seenUrls.add(url)
            allUrls.push(url)
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
    // /shop/g/ で始まるパスが商品ページ
    return urlObj.pathname.match(/^\/shop\/g\/[^\/]+/) !== null &&
           urlObj.hostname.includes('business.mistore.jp')
  } catch {
    return false
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

