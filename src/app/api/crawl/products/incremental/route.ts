import { NextRequest, NextResponse } from 'next/server'

/**
 * 差分クロールを実行（更新が必要な商品のみ）
 */
export async function POST(req: NextRequest) {
  try {
    // メインのクロールAPIにリダイレクト
    const response = await fetch(`${req.nextUrl.origin}/api/crawl/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'incremental' })
    })
    
    const data = await response.json()
    return NextResponse.json(data)
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to start incremental crawl'
    console.error('[Crawl API] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

