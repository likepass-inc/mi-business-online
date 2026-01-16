import { NextRequest, NextResponse } from 'next/server'
import { scrapePage } from '@/lib/scraper'
import { parseProductPage } from '@/lib/productParser'
import { saveProduct } from '@/lib/db/productRepository'
import type { ProductData } from '@/lib/db/productRepository'

/**
 * 特定の商品をクロール
 * POST /api/crawl/products/single
 * Body: { product_code: "g020W-977" } または { product_url: "https://business.mistore.jp/shop/g/g020W-977/" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const productCode = body.product_code
    const productUrl = body.product_url

    if (!productCode && !productUrl) {
      return NextResponse.json(
        { success: false, error: 'product_code or product_url is required' },
        { status: 400 }
      )
    }

    // 商品URLを決定
    let url: string
    if (productUrl) {
      url = productUrl
    } else {
      // 商品コードからURLを生成
      url = `https://business.mistore.jp/shop/g/${productCode}/`
    }

    console.log(`[Single Crawl API] Starting crawl for: ${url}`)

    // HTMLを取得（Playwrightを使用）
    let html: string
    try {
      const { chromium } = await import('playwright')
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      const page = await browser.newPage()
      try {
        await page.setExtraHTTPHeaders({
          'Accept-Charset': 'UTF-8'
        })
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
        html = await page.content()
      } finally {
        await page.close().catch(() => {})
        await browser.close().catch(() => {})
      }
    } catch (playwrightError) {
      // Playwrightが失敗した場合、fetchを使用して再試行
      console.warn(`[Single Crawl API] Playwright failed, trying fetch:`, playwrightError)
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

        let decoder: TextDecoder
        try {
          decoder = new TextDecoder(charset as any, { fatal: false })
        } catch {
          decoder = new TextDecoder('utf-8', { fatal: false })
        }

        html = decoder.decode(buffer)
      } catch (fetchError) {
        throw new Error(`Both Playwright and fetch failed: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}`)
      }
    }

    // 商品情報をパース
    const productData = parseProductPage(html, url)

    if (!productData) {
      return NextResponse.json(
        { success: false, error: 'Failed to parse product data' },
        { status: 500 }
      )
    }

    // データベースに保存
    saveProduct(productData)

    console.log(`[Single Crawl API] Successfully crawled and saved: ${productData.product_code}`)

    return NextResponse.json({
      success: true,
      product_code: productData.product_code,
      product_name: productData.product_name,
      image_url: productData.image_urls && productData.image_urls.length > 0 ? productData.image_urls[0] : undefined,
      image_urls: productData.image_urls,
      availability: productData.availability,
      message: `Product ${productData.product_code} crawled and saved successfully`
    })

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to crawl product'
    console.error('[Single Crawl API] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
