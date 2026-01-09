import * as cheerio from 'cheerio'
import type { ProductData } from './db/productRepository'

export interface ParsedProductData extends ProductData {
  product_code: string
  product_name: string
  price_incl_tax?: number
  price_excl_tax?: number
  description?: string
  category?: string
  sub_category?: string
  product_url: string
  image_urls?: string[]
  availability?: string
}

/**
 * 商品ページのHTMLから商品情報を抽出
 */
export function parseProductPage(html: string, url: string): ParsedProductData | null {
  // HTMLのエンコーディングを確認
  // meta charsetタグからエンコーディングを取得
  const charsetMatch = html.match(/<meta[^>]*charset\s*=\s*["']?([^"'\s>]+)/i)
  const charset = charsetMatch ? charsetMatch[1].toLowerCase() : 'utf-8'
  
  // cheerioでパース（UTF-8を想定）
  // HTMLがUTF-8でない場合でも、Playwrightが既にUTF-8に変換しているはず
  const $ = cheerio.load(html)
  const baseUrl = new URL(url)

  // 基本情報を抽出
  const basicInfo = extractProductBasicInfo($, url)
  if (!basicInfo.product_code || !basicInfo.product_name) {
    return null
  }

  // 画像を抽出
  const imageUrls = extractProductImages($, baseUrl)

  // 価格情報を抽出
  const priceInfo = extractProductPrice($)

  // 在庫状況を抽出
  const availability = extractProductAvailability($)

  // カテゴリ情報を抽出
  const categoryInfo = extractProductCategory($, url)

  // 商品説明を抽出
  let description = extractProductDescription($)

  // 構造化データから情報を取得（補完）
  const structuredData = extractStructuredData($)
  if (structuredData) {
    // 構造化データがあれば、不足している情報を補完
    if (!basicInfo.product_name && structuredData.name) {
      basicInfo.product_name = structuredData.name
    }
    if (!priceInfo.price_incl_tax && structuredData.price) {
      priceInfo.price_incl_tax = structuredData.price
    }
    if (!description && structuredData.description) {
      description = structuredData.description
    }
    if (structuredData.image && imageUrls.length === 0) {
      imageUrls.push(structuredData.image)
    }
  }

  return {
    product_code: basicInfo.product_code,
    product_name: basicInfo.product_name,
    price_incl_tax: priceInfo.price_incl_tax,
    price_excl_tax: priceInfo.price_excl_tax,
    description: description || undefined,
    category: categoryInfo.category || undefined,
    sub_category: categoryInfo.sub_category || undefined,
    product_url: url,
    image_urls: imageUrls.length > 0 ? imageUrls : undefined,
    availability: availability || undefined
  }
}

/**
 * 基本情報（商品名、商品コード）を抽出
 */
function extractProductBasicInfo($: ReturnType<typeof cheerio.load>, url: string): {
  product_code: string
  product_name: string
} {
  let productCode = ''
  let productName = ''

  // URLから商品コードを抽出（/shop/g/商品コード の形式）
  const urlMatch = url.match(/\/shop\/g\/([^\/\?]+)/)
  if (urlMatch) {
    productCode = urlMatch[1]
  }

  // タイトルタグから商品名を抽出
  const title = $('title').first().text().trim()
  if (title) {
    // タイトルからサイト名などを除去
    productName = title
      .replace(/\s*[-|]\s*.*$/, '') // ハイフン以降を削除
      .replace(/\s*\|.*$/, '') // パイプ以降を削除
      .trim()
  }

  // H1タグから商品名を抽出（タイトルがない場合）
  if (!productName) {
    const h1 = $('h1').first().text().trim()
    if (h1) {
      productName = h1
    }
  }

  // メタタグから商品名を抽出
  if (!productName) {
    const ogTitle = $('meta[property="og:title"]').attr('content')
    if (ogTitle) {
      productName = ogTitle.trim()
    }
  }

  // 商品コードがURLから取得できない場合、ページ内の要素から探す
  if (!productCode) {
    // よくある商品コードの表示パターンを探す
    const codePatterns = [
      /商品コード[：:]\s*([A-Z0-9\-]+)/i,
      /商品番号[：:]\s*([A-Z0-9\-]+)/i,
      /品番[：:]\s*([A-Z0-9\-]+)/i,
      /code[：:]\s*([A-Z0-9\-]+)/i
    ]

    for (const pattern of codePatterns) {
      const match = $('body').text().match(pattern)
      if (match) {
        productCode = match[1]
        break
      }
    }
  }

  // データ属性から商品コードを取得
  if (!productCode) {
    const dataCode = $('[data-product-code]').attr('data-product-code') ||
                     $('[data-product-id]').attr('data-product-id') ||
                     $('[data-code]').attr('data-code')
    if (dataCode) {
      productCode = dataCode
    }
  }

  return {
    product_code: productCode || url.split('/').pop() || '',
    product_name: productName || '商品名不明'
  }
}

/**
 * 商品画像を抽出
 */
function extractProductImages($: ReturnType<typeof cheerio.load>, baseUrl: URL): string[] {
  const imageUrls: string[] = []

  // メイン商品画像を探す（よくあるセレクタ）
  const mainImageSelectors = [
    '.product-image img',
    '.product-main-image img',
    '.product-photo img',
    '.main-image img',
    '[class*="product"][class*="image"] img',
    '[class*="product"][class*="photo"] img'
  ]

  for (const selector of mainImageSelectors) {
    const images = $(selector)
    if (images.length > 0) {
      images.each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src')
        if (src) {
          try {
            const imageUrl = new URL(src, baseUrl).href
            if (!imageUrls.includes(imageUrl)) {
              imageUrls.push(imageUrl)
            }
          } catch {
            // URL解析エラーは無視
          }
        }
      })
      if (imageUrls.length > 0) break
    }
  }

  // OG画像を取得
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) {
    try {
      const imageUrl = new URL(ogImage, baseUrl).href
      if (!imageUrls.includes(imageUrl)) {
        imageUrls.unshift(imageUrl) // 最初に追加
      }
    } catch {
      // URL解析エラーは無視
    }
  }

  // 構造化データから画像を取得
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      if (json.image) {
        const images = Array.isArray(json.image) ? json.image : [json.image]
        images.forEach((img: string) => {
          try {
            const imageUrl = new URL(img, baseUrl).href
            if (!imageUrls.includes(imageUrl)) {
              imageUrls.push(imageUrl)
            }
          } catch {
            // URL解析エラーは無視
          }
        })
      }
    } catch {
      // JSON解析エラーは無視
    }
  })

  return imageUrls.slice(0, 10) // 最大10枚まで
}

/**
 * 価格情報を抽出
 */
function extractProductPrice($: ReturnType<typeof cheerio.load>): {
  price_incl_tax?: number
  price_excl_tax?: number
} {
  let priceInclTax: number | undefined
  let priceExclTax: number | undefined

  // よくある価格表示のセレクタ
  const priceSelectors = [
    '.price',
    '.product-price',
    '.price-incl-tax',
    '[class*="price"]',
    '[data-price]'
  ]

  for (const selector of priceSelectors) {
    const priceEl = $(selector).first()
    if (priceEl.length > 0) {
      const priceText = priceEl.text().trim()
      const priceMatch = priceText.match(/(\d{1,3}(?:,\d{3})*)/)
      if (priceMatch) {
        const price = parseInt(priceMatch[1].replace(/,/g, ''))
        if (price > 0) {
          // 税込価格か税抜価格かを判定
          if (priceText.includes('税込') || priceText.includes('税込み') || priceText.includes('(税込)')) {
            priceInclTax = price
          } else if (priceText.includes('税抜') || priceText.includes('税抜き') || priceText.includes('(税抜)')) {
            priceExclTax = price
          } else {
            // デフォルトは税込価格とみなす
            priceInclTax = price
          }
          break
        }
      }
    }
  }

  // データ属性から価格を取得
  if (!priceInclTax && !priceExclTax) {
    const dataPrice = $('[data-price]').attr('data-price') ||
                      $('[data-price-incl-tax]').attr('data-price-incl-tax')
    if (dataPrice) {
      const price = parseInt(dataPrice.replace(/,/g, ''))
      if (price > 0) {
        priceInclTax = price
      }
    }
  }

  // 構造化データから価格を取得
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      if (json.offers && json.offers.price) {
        const price = parseFloat(json.offers.price)
        if (price > 0) {
          priceInclTax = Math.round(price)
        }
      }
    } catch {
      // JSON解析エラーは無視
    }
  })

  return {
    price_incl_tax: priceInclTax,
    price_excl_tax: priceExclTax
  }
}

/**
 * 在庫状況を抽出
 */
function extractProductAvailability($: ReturnType<typeof cheerio.load>): string | null {
  // 在庫状況のよくある表示パターン
  const availabilityPatterns = [
    /在庫あり/i,
    /在庫なし/i,
    /入荷待ち/i,
    /予約受付中/i,
    /販売終了/i,
    /売り切れ/i
  ]

  const bodyText = $('body').text()

  for (const pattern of availabilityPatterns) {
    const match = bodyText.match(pattern)
    if (match) {
      return match[0]
    }
  }

  // 構造化データから在庫状況を取得
  let availability: string | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      if (json.offers && json.offers.availability) {
        const avail = json.offers.availability
        if (typeof avail === 'string') {
          if (avail.includes('InStock')) {
            availability = '在庫あり'
          } else if (avail.includes('OutOfStock')) {
            availability = '在庫なし'
          } else if (avail.includes('PreOrder')) {
            availability = '予約受付中'
          }
        }
      }
    } catch {
      // JSON解析エラーは無視
    }
  })

  return availability
}

/**
 * カテゴリ情報を抽出
 */
function extractProductCategory($: ReturnType<typeof cheerio.load>, url: string): {
  category?: string
  sub_category?: string
} {
  // URLからカテゴリを推測
  const urlMatch = url.match(/\/shop\/c\/([^\/]+)/)
  if (urlMatch) {
    return {
      category: decodeURIComponent(urlMatch[1])
    }
  }

  // パンくずリストからカテゴリを取得
  const breadcrumbs = $('.breadcrumb a, .breadcrumbs a, [class*="breadcrumb"] a')
  if (breadcrumbs.length > 0) {
    const categories: string[] = []
    breadcrumbs.each((_, el) => {
      const text = $(el).text().trim()
      if (text && !text.match(/ホーム|トップ|Home|Top/i)) {
        categories.push(text)
      }
    })
    if (categories.length > 0) {
      return {
        category: categories[0],
        sub_category: categories.length > 1 ? categories[1] : undefined
      }
    }
  }

  // 構造化データからカテゴリを取得
  let category: string | undefined
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      if (json.category) {
        category = json.category
      }
    } catch {
      // JSON解析エラーは無視
    }
  })

  return { category }
}

/**
 * 商品説明を抽出
 */
function extractProductDescription($: ReturnType<typeof cheerio.load>): string {
  // メタディスクリプション
  const metaDesc = $('meta[name="description"]').attr('content')
  if (metaDesc) {
    return metaDesc.trim()
  }

  // OGディスクリプション
  const ogDesc = $('meta[property="og:description"]').attr('content')
  if (ogDesc) {
    return ogDesc.trim()
  }

  // 商品説明セクションを探す
  const descSelectors = [
    '.product-description',
    '.product-detail',
    '[class*="description"]',
    '[class*="detail"]'
  ]

  for (const selector of descSelectors) {
    const descEl = $(selector).first()
    if (descEl.length > 0) {
      const text = descEl.text().trim()
      if (text.length > 50) { // ある程度の長さがある場合
        return text.substring(0, 1000) // 最大1000文字
      }
    }
  }

  // 構造化データから説明を取得
  let description = ''
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      if (json.description) {
        description = json.description
        return false // break
      }
    } catch {
      // JSON解析エラーは無視
    }
  })

  return description
}

/**
 * 構造化データ（JSON-LD）から情報を抽出
 */
function extractStructuredData($: ReturnType<typeof cheerio.load>): {
  name?: string
  price?: number
  description?: string
  image?: string
} | null {
  let result: {
    name?: string
    price?: number
    description?: string
    image?: string
  } | null = null

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      
      // Product スキーマを探す
      const schemas = Array.isArray(json['@graph']) ? json['@graph'] : [json]
      
      for (const schema of schemas) {
        if (schema['@type'] === 'Product' || schema['@type'] === 'http://schema.org/Product') {
          result = {
            name: schema.name,
            description: schema.description,
            image: schema.image || (schema.image && schema.image.url) || undefined
          }
          
          if (schema.offers) {
            const offers = Array.isArray(schema.offers) ? schema.offers[0] : schema.offers
            if (offers.price) {
              result.price = parseFloat(offers.price)
            }
          }
          
          break
        }
      }
    } catch {
      // JSON解析エラーは無視
    }
  })

  return result
}

