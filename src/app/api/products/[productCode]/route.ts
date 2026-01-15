import { NextRequest, NextResponse } from 'next/server'
import { getProductByCode } from '@/lib/db/productRepository'

/**
 * 商品詳細取得API
 * GET /api/products/[productCode]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { productCode: string } }
) {
  try {
    const productCode = params.productCode
    
    console.log('[Products API] Fetching product:', productCode)
    
    const product = getProductByCode(productCode)
    
    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found'
        },
        { status: 404 }
      )
    }
    
    // WordPress/STORK19用のレスポンス形式
    return NextResponse.json({
      success: true,
      data: product
    })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to fetch product'
    console.error('[Products API] Error:', errorMessage)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}

