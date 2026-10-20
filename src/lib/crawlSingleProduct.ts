import { isSiteChromeProductName, parseProductPage } from '@/lib/productParser'
import { getProductsByCodes, saveProduct, type ProductData } from '@/lib/db/productRepository'
import { getSeasonMapEntryForCode, normalizeProductCode, shopProductCode } from '@/lib/seasonMap'
import type { Product } from '@/lib/types'

const SHOP_ORIGIN = 'https://business.mistore.jp'

export type CrawlSingleResult =
  | { status: 'saved'; product: ProductData }
  | { status: 'missing' }
  | { status: 'unavailable' }

function shopUrlForCode(productCode: string): string {
  const code = productCode.trim().replace(/^\/+|\/+$/g, '')
  return `${SHOP_ORIGIN}/shop/g/${encodeURIComponent(code)}/`
}

function hasJapanese(text: string): boolean {
  return /[ぁ-んァ-ン一-龯]/.test(text)
}

function decodeShopHtml(buffer: ArrayBuffer, contentType: string): string {
  const head = new TextDecoder('iso-8859-1').decode(buffer.slice(0, 2048))
  const metaCharset = head.match(/<meta[^>]*charset\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase() || ''
  const headerCharset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase() || ''
  const declared = metaCharset || headerCharset || 'utf-8'
  const shiftJis = declared === 'shift_jis' || declared === 'shift-jis' || declared === 'sjis' || declared === 'cp932' || declared === 'windows-31j'

  const decode = (label: string) => {
    try {
      return new TextDecoder(label, { fatal: false }).decode(buffer)
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    }
  }

  if (shiftJis) {
    return decode('shift_jis')
  }
  if (declared === 'euc-jp' || declared === 'eucjp') {
    return decode('euc-jp')
  }

  const asUtf8 = decode('utf-8')
  if (hasJapanese(asUtf8)) {
    return asUtf8
  }
  const asShiftJis = decode('shift_jis')
  if (hasJapanese(asShiftJis)) {
    return asShiftJis
  }
  return asUtf8
}

async function fetchShopHtml(url: string): Promise<{ html: string } | { missing: true } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Charset': 'UTF-8',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (response.status === 404) {
      return { missing: true }
    }
    if (!response.ok) {
      return null
    }
    const buffer = await response.arrayBuffer()
    return { html: decodeShopHtml(buffer, response.headers.get('content-type') || '') }
  } catch (error) {
    console.warn('[Single Crawl] fetch failed:', error instanceof Error ? error.message : error)
    return null
  }
}

async function fetchShopHtmlWithPlaywright(url: string): Promise<string | null> {
  try {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      if (response && response.status() === 404) {
        return null
      }
      return await page.content()
    } finally {
      await page.close().catch(() => {})
      await browser.close().catch(() => {})
    }
  } catch (error) {
    console.warn('[Single Crawl] Playwright failed:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * ショップの商品ページを取得してパースし、索引へ保存する。
 * ページが無いコードは missing。取得できない場合は unavailable（呼び出し側は空のまま返す）。
 */
export async function crawlAndSaveProduct(input: {
  productCode?: string
  productUrl?: string
}): Promise<CrawlSingleResult> {
  const productCode = input.productCode?.trim() || ''
  const url = input.productUrl?.trim() || (productCode ? shopUrlForCode(productCode) : '')
  if (!url) {
    return { status: 'missing' }
  }

  console.log(`[Single Crawl] Fetching ${url}`)
  const fetched = await fetchShopHtml(url)
  if (fetched && 'missing' in fetched) {
    return { status: 'missing' }
  }

  let html = fetched && 'html' in fetched ? fetched.html : null
  if (!html) {
    html = await fetchShopHtmlWithPlaywright(url)
  }
  if (!html) {
    return { status: 'unavailable' }
  }

  const productData = parseProductPage(html, url)
  if (!productData || !productData.product_code || !productData.product_name.trim()) {
    return { status: 'missing' }
  }

  saveProduct(productData)
  console.log(`[Single Crawl] Saved ${productData.product_code}`)
  return { status: 'saved', product: productData }
}

export function productLacksCatalog(product: Product): boolean {
  const price = Number(product.price_incl_tax || 0)
  const hasImage = Boolean(product.image_url) || Boolean(product.image_urls && product.image_urls.length)
  return price <= 0 && !hasImage
}

export function indexedProductNeedsShopRefresh(product: Product): boolean {
  const name = (product.product_name || '').trim()
  if (!name || name === '商品' || name === '商品名不明') {
    return true
  }
  if (isSiteChromeProductName(name)) {
    return true
  }
  if (!productLacksCatalog(product)) {
    return false
  }
  const availability = String(product.availability || '')
  if (availability.includes('販売終了') || availability.includes('販売を終了')) {
    return false
  }
  return true
}

export function crawlTargetForCode(code: string): { productCode: string; productUrl?: string } {
  const entry = getSeasonMapEntryForCode(code)
  if (entry?.to) {
    return {
      productCode: shopProductCode(entry.to),
      productUrl: entry.to_url || undefined,
    }
  }
  return { productCode: code }
}

function productMatchesCode(product: Product, key: string): boolean {
  return [product.product_code, product.requested_product_code, product.canonical_product_code].some(
    (value) => normalizeProductCode(value || '') === key
  )
}

/**
 * 索引にある商品コードはそのまま返し、無いコードとカタログ情報（画像・価格）が無い行だけショップから取り直す。
 * 季節品番は現行（to）のショップURLを取りに行く。ショップに実在する商品は保存して返す。
 */
export async function productsIncludingShopIndex(productCodes: string[]): Promise<Product[]> {
  const products = getProductsByCodes(productCodes)
  const seen = new Set<string>()
  const toRefresh: string[] = []

  for (const code of productCodes) {
    const key = normalizeProductCode(code)
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    const indexed = products.find((product) => productMatchesCode(product, key))
    if (indexed && !indexedProductNeedsShopRefresh(indexed)) {
      continue
    }
    toRefresh.push(code)
  }

  const concurrency = 4
  for (let i = 0; i < toRefresh.length; i += concurrency) {
    const batch = toRefresh.slice(i, i + concurrency)
    await Promise.all(batch.map(async (code) => {
      const key = normalizeProductCode(code)
      try {
        const crawled = await crawlAndSaveProduct(crawlTargetForCode(code))
        if (crawled.status !== 'saved') {
          return
        }
        for (let index = products.length - 1; index >= 0; index -= 1) {
          if (productMatchesCode(products[index], key)) {
            products.splice(index, 1)
          }
        }
        const saved = getProductsByCodes([code])
        for (const product of saved) {
          products.push(product)
          const savedKey = normalizeProductCode(product.product_code)
          if (savedKey) {
            seen.add(savedKey)
          }
        }
      } catch (error) {
        console.warn(
          '[Products API] Index crawl failed for',
          code,
          error instanceof Error ? error.message : error
        )
      }
    }))
  }

  return products
}
