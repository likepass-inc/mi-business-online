import { NextRequest, NextResponse } from 'next/server'
import {
  loadProducts,
  calculateMatchScore,
  getArticleCategory
} from '@/lib/productService'
import type { RelatedProductsRequest, RelatedProductsResponse } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now()
    const searchParams = req.nextUrl.searchParams
    
    const article_id = searchParams.get('article_id') || ''
    const category = searchParams.get('category') || undefined
    const limit = parseInt(searchParams.get('limit') || '6')
    const min_price = searchParams.get('min_price') 
      ? parseInt(searchParams.get('min_price')!) 
      : undefined
    const max_price = searchParams.get('max_price') 
      ? parseInt(searchParams.get('max_price')!) 
      : undefined
    
    console.log('[Magazine Related Products API] Request received:', {
      article_id,
      category,
      limit,
      min_price,
      max_price
    })
    
    // 記事IDまたはカテゴリが必須
    if (!article_id && !category) {
      return NextResponse.json(
        { 
          success: false,
          error: 'article_id or category is required' 
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
    const articleCategory = getArticleCategory(article_id, category)
    
    if (!articleCategory) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid article_id (${article_id}) or category (${category}). Supported values: 315, 2638, 3033, お詫び・謝罪, 退職, 差し入れ・手土産, お祝い`
        },
        { status: 400 }
      )
    }
    
    // 関連商品を検索・スコアリング
    const scoredProducts = products
      .map(product => ({
        ...product,
        match_score: calculateMatchScore(articleCategory, product)
      }))
      .filter(product => product.match_score >= 60) // 閾値60点以上
      .filter(product => {
        if (min_price && product.price_incl_tax < min_price) return false
        if (max_price && product.price_incl_tax > max_price) return false
        return true
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit)
    
    const executionTime = Date.now() - startTime
    
    const response: RelatedProductsResponse = {
      success: true,
      article_id: article_id || category || '',
      total_products: scoredProducts.length,
      products: scoredProducts,
      metadata: {
        category: articleCategory.name,
        match_score_threshold: 60,
        execution_time_ms: executionTime
      }
    }
    
    console.log(`[Magazine Related Products API] Successfully returned ${scoredProducts.length} products`)
    return NextResponse.json(response)
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to fetch related products'
    const errorStack = e instanceof Error ? e.stack : undefined
    console.error('[Magazine Related Products API] Error:', errorMessage)
    if (errorStack) {
      console.error('[Magazine Related Products API] Error stack:', errorStack)
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

