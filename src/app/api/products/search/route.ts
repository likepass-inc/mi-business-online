import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/db/productRepository'

/**
 * 商品検索API
 * GET /api/products/search?q=検索キーワード&limit=100&offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const q = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    if (!q) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search query (q) is required'
        },
        { status: 400 }
      )
    }
    
    console.log('[Products Search API] Search query:', q)
    
    const result = searchProducts(q, limit, offset)
    
    // WordPress/SWELL用のレスポンス形式
    return NextResponse.json({
      success: true,
      query: q,
      data: result.products,
      pagination: {
        total: result.total,
        limit,
        offset,
        has_more: offset + limit < result.total
      }
    })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to search products'
    console.error('[Products Search API] Error:', errorMessage)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}

