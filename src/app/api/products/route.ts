import { NextRequest, NextResponse } from 'next/server'
import { getAllProducts, searchProducts } from '@/lib/db/productRepository'

/**
 * 商品一覧取得API
 * GET /api/products?category=カテゴリ&limit=100&offset=0&sort=updated_desc
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const category = searchParams.get('category') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sort = (searchParams.get('sort') as 'name' | 'price_asc' | 'price_desc' | 'updated_desc') || 'updated_desc'
    const q = searchParams.get('q') // 検索キーワード
    
    console.log('[Products API] Request:', { category, limit, offset, sort, q })
    
    let result
    
    if (q) {
      // 検索クエリがある場合は検索を実行
      result = searchProducts(q, limit, offset)
    } else {
      // 通常の一覧取得
      result = getAllProducts({ category, limit, offset, sort })
    }
    
    // WordPress/SWELL用のレスポンス形式
    return NextResponse.json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        limit,
        offset,
        has_more: offset + limit < result.total
      }
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to fetch products'
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

