import { NextRequest, NextResponse } from 'next/server'
import {
  getAllProducts,
  searchProducts,
  getProductsByCodes,
  getNewProducts,
  getDiscontinuedProducts
} from '@/lib/db/productRepository'

/**
 * 商品一覧取得API
 * GET /api/products?category=カテゴリ&limit=100&offset=0&sort=updated_desc
 * GET /api/products?product_code[]=ABC123&product_code[]=DEF456
 * GET /api/products?product_id[]=ABC123&product_id[]=DEF456
 * GET /api/products?filter=new&days=7  新商品（直近N日）
 * GET /api/products?filter=discontinued 販売終了商品
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const category = searchParams.get('category') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sort = (searchParams.get('sort') as 'name' | 'price_asc' | 'price_desc' | 'updated_desc') || 'updated_desc'
    const q = searchParams.get('q') // 検索キーワード
    const filter = searchParams.get('filter') // 'new' | 'discontinued'
    const days = parseInt(searchParams.get('days') || '7', 10) // filter=new 時の日数（デフォルト7）
    
    // 複数商品コードの取得（product_code[] または product_id[]）
    const productCodesParam = searchParams.getAll('product_code[]')
    const productIdsParam = searchParams.getAll('product_id[]')
    const productCodes = productCodesParam.length > 0 ? productCodesParam : productIdsParam
    
    console.log('[Products API] Request:', { category, limit, offset, sort, q, productCodesCount: productCodes.length })
    
    // 複数商品コードが指定された場合
    if (productCodes.length > 0) {
      const products = getProductsByCodes(productCodes)

      // WordPress/STORK19用のレスポンス形式
      return NextResponse.json({
        success: true,
        data: products,
        pagination: {
          total: products.length,
          limit: products.length,
          offset: 0,
          has_more: false
        }
      }, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      })
    }
    
    // 新商品・販売終了フィルタ
    if (filter === 'new') {
      const result = getNewProducts(days, limit, offset)
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
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      })
    }
    if (filter === 'discontinued') {
      const result = getDiscontinuedProducts(limit, offset)
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
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      })
    }
    
    // 既存のロジック（カテゴリ、検索、ページネーション）
    let result
    
    if (q) {
      // 検索クエリがある場合は検索を実行
      result = searchProducts(q, limit, offset)
    } else {
      // 通常の一覧取得
      result = getAllProducts({ category, limit, offset, sort })
    }
    
    // WordPress/STORK19用のレスポンス形式
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

