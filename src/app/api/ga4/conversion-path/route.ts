import { NextRequest, NextResponse } from 'next/server'
import { fetchGA4Data } from '@/lib/ga4Client'
import type { DateRange } from '@/lib/types'

interface ConversionStep {
  step: string
  users: number
  dropoffRate: number
  conversionRate: number
}

interface ConversionPathData {
  steps: ConversionStep[]
  totalConversions: number
  overallConversionRate: number
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { dateRange }: { dateRange: DateRange } = body

    if (!dateRange) {
      return NextResponse.json(
        { error: 'dateRange is required' },
        { status: 400 }
      )
    }

    // GA4からコンバージョン経路データを取得
    // 実際の実装では、GA4のエクスプローラーAPIを使用してデータを取得
    // ここでは、セッション、イベント、コンバージョンのデータから経路を構築

    // ステップ1: マガジン記事閲覧
    const magazineViews = await fetchGA4Data({
      dateRange,
      metrics: ['sessions'],
      dimensions: ['pagePath'],
      filters: [
        {
          field: 'pagePath',
          operator: 'CONTAINS',
          value: '/magazine/article/',
        },
      ],
    })

    // ステップ2: 商品ページ閲覧
    const productViews = await fetchGA4Data({
      dateRange,
      metrics: ['sessions'],
      dimensions: ['pagePath'],
      filters: [
        {
          field: 'pagePath',
          operator: 'CONTAINS',
          value: '/shop/',
        },
      ],
    })

    // ステップ3: カート追加
    const addToCart = await fetchGA4Data({
      dateRange,
      metrics: ['eventCount'],
      dimensions: ['eventName'],
      filters: [
        {
          field: 'eventName',
          operator: 'EXACT',
          value: 'add_to_cart',
        },
      ],
    })

    // ステップ4: 購入完了
    const purchases = await fetchGA4Data({
      dateRange,
      metrics: ['conversions'],
      dimensions: ['eventName'],
      filters: [
        {
          field: 'eventName',
          operator: 'EXACT',
          value: 'purchase',
        },
      ],
    })

    // データを集計
    const magazineUsers = magazineViews.rows.reduce(
      (sum, row) => sum + (Number(row.sessions) || 0),
      0
    )
    const productUsers = productViews.rows.reduce(
      (sum, row) => sum + (Number(row.sessions) || 0),
      0
    )
    const cartUsers = addToCart.rows.reduce(
      (sum, row) => sum + (Number(row.eventCount) || 0),
      0
    )
    const purchaseUsers = purchases.rows.reduce(
      (sum, row) => sum + (Number(row.conversions) || 0),
      0
    )

    // 離脱率とコンバージョン率を計算
    const steps: ConversionStep[] = [
      {
        step: 'マガジン記事閲覧',
        users: magazineUsers,
        dropoffRate: magazineUsers > 0 ? ((magazineUsers - productUsers) / magazineUsers) * 100 : 0,
        conversionRate: 0,
      },
      {
        step: '商品ページ閲覧',
        users: productUsers,
        dropoffRate: productUsers > 0 ? ((productUsers - cartUsers) / productUsers) * 100 : 0,
        conversionRate: 0,
      },
      {
        step: 'カート追加',
        users: cartUsers,
        dropoffRate: cartUsers > 0 ? ((cartUsers - purchaseUsers) / cartUsers) * 100 : 0,
        conversionRate: 0,
      },
      {
        step: '購入完了',
        users: purchaseUsers,
        dropoffRate: 0,
        conversionRate: magazineUsers > 0 ? (purchaseUsers / magazineUsers) * 100 : 0,
      },
    ]

    const totalConversions = purchaseUsers
    const overallConversionRate = magazineUsers > 0 ? (purchaseUsers / magazineUsers) * 100 : 0

    const pathData: ConversionPathData = {
      steps,
      totalConversions,
      overallConversionRate,
    }

    return NextResponse.json(pathData)
  } catch (error) {
    console.error('Error fetching conversion path:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversion path data' },
      { status: 500 }
    )
  }
}
