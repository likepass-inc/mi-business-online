import { NextRequest, NextResponse } from 'next/server'
import { crawlAndSaveProduct } from '@/lib/crawlSingleProduct'

/**
 * 特定の商品をクロール
 * POST /api/crawl/products/single
 * Body: { product_code: "g020W-977" } または { product_url: "https://business.mistore.jp/shop/g/g020W-977/" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const productCode = typeof body.product_code === 'string' ? body.product_code : ''
    const productUrl = typeof body.product_url === 'string' ? body.product_url : ''

    if (!productCode && !productUrl) {
      return NextResponse.json(
        { success: false, error: 'product_code or product_url is required' },
        { status: 400 }
      )
    }

    const result = await crawlAndSaveProduct({ productCode, productUrl })
    if (result.status === 'missing') {
      return NextResponse.json(
        { success: false, error: 'Product page was not found' },
        { status: 404 }
      )
    }
    if (result.status !== 'saved') {
      return NextResponse.json(
        { success: false, error: 'Failed to crawl product' },
        { status: 500 }
      )
    }

    const productData = result.product
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
