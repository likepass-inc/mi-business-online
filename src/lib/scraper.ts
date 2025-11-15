import * as cheerio from 'cheerio'
import { chromium } from 'playwright'

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

export async function scrapePage(url: string, useJavaScript = false): Promise<ScrapedData> {
  let html: string

  if (useJavaScript) {
    // Playwrightを使用してJavaScript実行後のHTMLを取得
    const browser = await chromium.launch()
    const page = await browser.newPage()
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      html = await page.content()
    } finally {
      await browser.close()
    }
  } else {
    // 静的HTMLのみ取得
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }
    html = await response.text()
  }

  const $ = cheerio.load(html)
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

  return {
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
}

