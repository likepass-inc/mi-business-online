import { NextRequest, NextResponse } from 'next/server'
import { loadProducts, getArticleCategory } from '@/lib/productService'
import type { CategoryProductsResponse } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    
    const category = searchParams.get('category') || ''
    const limit = parseInt(searchParams.get('limit') || '12')
    const sort = searchParams.get('sort') as 'price_asc' | 'price_desc' | 'popular' | 'new' || 'popular'
    const page = parseInt(searchParams.get('page') || '1')
    
    console.log('[Magazine Products by Category API] Request received:', {
      category,
      limit,
      sort,
      page
    })
    
    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: 'category is required'
        },
        { status: 400 }
      )
    }
    
    // 商品データ読み込み
    const products = await loadProducts()
    
    if (products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No products available. Please check PRODUCT_CSV_PATH environment variable.'
      }, { status: 503 })
    }
    
    // 記事カテゴリ取得
    const articleCategory = getArticleCategory(undefined, category)
    
    if (!articleCategory) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid category: ${category}. Supported values: お詫び・謝罪, 退職, 差し入れ・手土産, お祝い`
        },
        { status: 400 }
      )
    }
    
    // カテゴリでフィルタリング
    let filteredProducts = products.filter(product =>
      product.tags.some(tag => articleCategory.tags.includes(tag))
    )
    
    // ソート
    if (sort === 'price_asc') {
      filteredProducts.sort((a, b) => a.price_incl_tax - b.price_incl_tax)
    } else if (sort === 'price_desc') {
      filteredProducts.sort((a, b) => b.price_incl_tax - a.price_incl_tax)
    } else if (sort === 'popular') {
      // 人気順はスコア順（将来的に実売データがあればそれを使用）
      filteredProducts = filteredProducts
        .map(product => ({
          ...product,
          match_score: product.match_score || 0
        }))
        .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
    }
    // 'new' の場合は元の順序を維持
    
    // ページネーション
    const startIndex = (page - 1) * limit
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit)
    
    const response: CategoryProductsResponse = {
      success: true,
      category,
      total_products: filteredProducts.length,
      page,
      limit,
      products: paginatedProducts
    }
    
    console.log(`[Magazine Products by Category API] Successfully returned ${paginatedProducts.length} products`)
    return NextResponse.json(response)
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to fetch products by category'
    const errorStack = e instanceof Error ? e.stack : undefined
    console.error('[Magazine Products by Category API] Error:', errorMessage)
    if (errorStack) {
      console.error('[Magazine Products by Category API] Error stack:', errorStack)
    }
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}

