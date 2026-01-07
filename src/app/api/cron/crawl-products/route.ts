import { NextRequest, NextResponse } from 'next/server'

/**
 * Cron用の商品クロール実行API
 * 外部cronサービス（cron-job.org等）から呼び出し可能
 * 
 * 認証: CRON_SECRET環境変数で保護
 * 
 * 使用方法:
 * - cron-job.org等でこのエンドポイントを毎日呼び出す
 * - ヘッダーに Authorization: Bearer {CRON_SECRET} を含める
 */
export async function GET(req: NextRequest) {
  try {
    // 認証チェック
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret) {
      const expectedAuth = `Bearer ${cronSecret}`
      if (authHeader !== expectedAuth) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized'
          },
          { status: 401 }
        )
      }
    }
    
    // クロールを実行（非同期）
    const crawlUrl = `${req.nextUrl.origin}/api/crawl/products`
    
    // 差分クロールを実行（毎日の定期実行では差分のみ）
    const response = await fetch(crawlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'incremental' })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || 'Failed to start crawl'
        },
        { status: response.status }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Crawl started successfully',
      log_id: data.log_id
    })
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to execute cron crawl'
    console.error('[Cron API] Error:', errorMessage)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}

/**
 * POSTメソッドもサポート（一部のcronサービスで使用）
 */
export async function POST(req: NextRequest) {
  return GET(req)
}

