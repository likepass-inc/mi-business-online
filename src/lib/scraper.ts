import * as cheerio from 'cheerio'
import { chromium, Browser } from 'playwright'

export interface ScrapedData {
  url: string
  title?: string
  metaDescription?: string
  h1?: string[]
  h2?: string[]
  h3?: string[]
  images?: Array<{ src: string; alt: string }>
  internalLinks?: string[]
  structuredData?: any[]
  hasCanonical?: boolean
  canonicalUrl?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
}

// ブラウザのシングルトンインスタンス
let browserInstance: Browser | null = null
let browserLaunchPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise
  }

  browserLaunchPromise = chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  }).catch((error) => {
    console.error('Failed to launch browser:', error)
    browserLaunchPromise = null
    throw new Error(`Failed to launch Playwright browser: ${error instanceof Error ? error.message : String(error)}`)
  })

  try {
    browserInstance = await browserLaunchPromise
    console.log('Playwright browser launched successfully')
    return browserInstance
  } catch (error) {
    browserLaunchPromise = null
    throw error
  }
}

// スクレイピング結果のキャッシュ（メモリベース）
const cache = new Map<string, { data: ScrapedData; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1時間

function getCachedData(url: string): ScrapedData | null {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  if (cached) {
    cache.delete(url)
  }
  return null
}

function setCachedData(url: string, data: ScrapedData): void {
  cache.set(url, { data, timestamp: Date.now() })
  // キャッシュサイズを制限（最大100件）
  if (cache.size > 100) {
    const oldestKey = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
    cache.delete(oldestKey)
  }
}

// リトライロジック（指数バックオフ）
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded')
}

export async function scrapePage(url: string, useJavaScript = false): Promise<ScrapedData> {
  // キャッシュをチェック
  const cached = getCachedData(url)
  if (cached) {
    return cached
  }

  let html: string
  let scrapeError: Error | null = null

  // useJavaScript=trueの場合は、Playwrightを優先的に使用（検証結果より）
  if (useJavaScript) {
    try {
      console.log(`Attempting to scrape ${url} with Playwright`)
      html = await retryWithBackoff(async () => {
        const browser = await getBrowser()
        const context = await browser.newContext({
          ignoreHTTPSErrors: true,
        })
        const page = await context.newPage()
        
        try {
          console.log(`Navigating to ${url} with Playwright`)
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          })
          const content = await page.content()
          console.log(`Successfully scraped ${url} with Playwright (${content.length} chars)`)
          await page.close()
          await context.close()
          return content
        } catch (error) {
          await page.close().catch(() => {})
          await context.close().catch(() => {})
          console.error(`Playwright navigation error for ${url}:`, error)
          throw error
        }
      }, 3, 1000)
    } catch (playwrightError) {
      scrapeError = playwrightError instanceof Error ? playwrightError : new Error(String(playwrightError))
      console.error(`Playwright failed for ${url}, falling back to fetch:`, scrapeError.message)
      // Playwrightが失敗した場合、fetchを試行
      try {
        console.log(`Attempting to scrape ${url} with fetch (fallback)`)
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
        }
        // エンコーディングを検出してデコード
        const contentType = response.headers.get('content-type') || ''
        let encoding = 'utf-8'
        
        // Content-Typeヘッダーからエンコーディングを取得
        const charsetMatch = contentType.match(/charset=([^;]+)/i)
        if (charsetMatch) {
          encoding = charsetMatch[1].trim().toLowerCase()
        }
        
        // HTMLのcharsetメタタグからもエンコーディングを取得
        const buffer = await response.arrayBuffer()
        const decoder = new TextDecoder(encoding as any)
        let tempHtml = decoder.decode(buffer)
        
        // HTMLのcharsetメタタグを確認
        const charsetMetaMatch = tempHtml.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s>]+)/i)
        if (charsetMetaMatch) {
          const htmlCharset = charsetMetaMatch[1].toLowerCase()
          if (htmlCharset !== encoding) {
            // HTMLのcharsetが異なる場合は再デコード
            const htmlDecoder = new TextDecoder(htmlCharset as any)
            html = htmlDecoder.decode(buffer)
          } else {
            html = tempHtml
          }
        } else {
          html = tempHtml
        }
        
        console.log(`Successfully scraped ${url} with fetch (fallback, ${html.length} chars, encoding: ${encoding})`)
      } catch (fetchError) {
        // 両方失敗した場合はエラーをスロー
        const errorMessage = `Failed to scrape page: Playwright error: ${scrapeError?.message}, Fetch error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
        console.error(`Both Playwright and fetch failed for ${url}:`, errorMessage)
        throw new Error(errorMessage)
      }
    }
  } else {
    // useJavaScript=falseの場合は、fetchを試行
    try {
      html = await retryWithBackoff(async () => {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
        }
        // エンコーディングを検出してデコード
        const contentType = response.headers.get('content-type') || ''
        let encoding = 'utf-8'
        
        // Content-Typeヘッダーからエンコーディングを取得
        const charsetMatch = contentType.match(/charset=([^;]+)/i)
        if (charsetMatch) {
          encoding = charsetMatch[1].trim().toLowerCase()
        }
        
        // HTMLのcharsetメタタグからもエンコーディングを取得
        const buffer = await response.arrayBuffer()
        const decoder = new TextDecoder(encoding as any)
        let tempHtml = decoder.decode(buffer)
        
        // HTMLのcharsetメタタグを確認
        const charsetMetaMatch = tempHtml.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s>]+)/i)
        if (charsetMetaMatch) {
          const htmlCharset = charsetMetaMatch[1].toLowerCase()
          if (htmlCharset !== encoding) {
            // HTMLのcharsetが異なる場合は再デコード
            const htmlDecoder = new TextDecoder(htmlCharset as any)
            html = htmlDecoder.decode(buffer)
          } else {
            html = tempHtml
          }
        } else {
          html = tempHtml
        }
        
        return html
      }, 3, 1000)
    } catch (fetchError) {
      // fetchが失敗した場合、Playwrightを試行
      try {
        html = await retryWithBackoff(async () => {
          const browser = await getBrowser()
          const context = await browser.newContext({
            ignoreHTTPSErrors: true,
          })
          const page = await context.newPage()
          
          try {
            await page.goto(url, {
              waitUntil: 'domcontentloaded',
              timeout: 20000,
            })
            const content = await page.content()
            await page.close()
            await context.close()
            return content
          } catch (error) {
            await page.close().catch(() => {})
            await context.close().catch(() => {})
            throw error
          }
        }, 2, 1000)
      } catch (playwrightError) {
        throw new Error(
          `Failed to scrape page: Fetch error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}, Playwright error: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}`
        )
      }
    }
  }

  // cheerioでHTMLをパースする際に、文字エンコーディングを明示的に指定
  const $ = cheerio.load(html, {
    decodeEntities: false,
    normalizeWhitespace: false,
  })
  const baseUrl = new URL(url)

  // タイトルとメタディスクリプション
  const title = $('title').first().text().trim()
  const metaDescription = $('meta[name="description"]').attr('content')?.trim()
  const canonicalUrl = $('link[rel="canonical"]').attr('href')

  // 見出しタグ
  const h1: string[] = []
  $('h1').each((_, el) => {
    const text = $(el).text().trim()
    if (text) h1.push(text)
  })

  const h2: string[] = []
  $('h2').each((_, el) => {
    const text = $(el).text().trim()
    if (text) h2.push(text)
  })

  const h3: string[] = []
  $('h3').each((_, el) => {
    const text = $(el).text().trim()
    if (text) h3.push(text)
  })

  // 画像
  const images: Array<{ src: string; alt: string }> = []
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || ''
    const alt = $(el).attr('alt') || ''
    if (src) {
      try {
        const imageUrl = new URL(src, baseUrl).href
        images.push({ src: imageUrl, alt })
      } catch {
        // URL解析エラーは無視
      }
    }
  })

  // 内部リンク
  const internalLinks: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) {
      try {
        const linkUrl = new URL(href, baseUrl)
        // 同じドメインのリンクのみ
        if (linkUrl.hostname === baseUrl.hostname) {
          internalLinks.push(linkUrl.href)
        }
      } catch {
        // URL解析エラーは無視
      }
    }
  })

  // 構造化データ
  const structuredData: any[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      structuredData.push(json)
    } catch {
      // JSON解析エラーは無視
    }
  })

  // OGタグ
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const ogDescription = $('meta[property="og:description"]').attr('content')
  const ogImage = $('meta[property="og:image"]').attr('content')

  const result: ScrapedData = {
    url,
    title,
    metaDescription,
    h1,
    h2,
    h3,
    images: images.slice(0, 20), // 最初の20件のみ
    internalLinks: Array.from(new Set(internalLinks)).slice(0, 50), // 重複除去して最初の50件
    structuredData,
    hasCanonical: !!canonicalUrl,
    canonicalUrl,
    ogTitle,
    ogDescription,
    ogImage,
  }

  // キャッシュに保存
  setCachedData(url, result)

  return result
}

