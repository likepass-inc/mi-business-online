import { NextRequest, NextResponse } from 'next/server'
import { fetchGSCData } from '@/lib/gscClient'
import type { DateRange } from '@/lib/types'

interface ContentAnalysisRequest {
  dateRange: DateRange
  category?: 'articles' | 'products' | 'product-lists' | 'all'
}

interface PageData {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface CategoryData {
  category: string
  pages: PageData[]
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
}

// URLパターンでカテゴリを判定
function getCategoryFromUrl(url: string): 'articles' | 'products' | 'product-lists' | null {
  if (url.startsWith('/magazine/article/')) {
    return 'articles'
  }
  if (url.startsWith('/shop/g/')) {
    return 'products'
  }
  if (url.startsWith('/shop/c/')) {
    return 'product-lists'
  }
  return null
}

// 前期間の日付範囲を計算
function getPreviousDateRange(dateRange: DateRange): DateRange {
  const startDate = new Date(dateRange.startDate)
  const endDate = new Date(dateRange.endDate)
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  const prevEndDate = new Date(startDate)
  prevEndDate.setDate(prevEndDate.getDate() - 1)
  
  const prevStartDate = new Date(prevEndDate)
  prevStartDate.setDate(prevStartDate.getDate() - daysDiff)
  
  return {
    startDate: prevStartDate.toISOString().split('T')[0],
    endDate: prevEndDate.toISOString().split('T')[0],
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ContentAnalysisRequest = await req.json()
    const { dateRange, category = 'all' } = body

    if (!dateRange.startDate || !dateRange.endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    // 現在期間のデータを取得
    const currentData = await fetchGSCData({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      dimensions: ['page'],
      rowLimit: 10000,
    })

    // 前期間のデータを取得
    const prevDateRange = getPreviousDateRange(dateRange)
    const prevData = await fetchGSCData({
      startDate: prevDateRange.startDate,
      endDate: prevDateRange.endDate,
      dimensions: ['page'],
      rowLimit: 10000,
    })

    // ページデータをカテゴリごとにグループ化
    const categoryMap = new Map<string, Map<string, PageData>>()
    
    // 現在期間のデータを処理
    currentData.rows.forEach((row) => {
      if (!row.page) return
      
      const pageCategory = getCategoryFromUrl(row.page)
      if (!pageCategory) return
      
      // カテゴリでフィルタリング
      if (category !== 'all' && category !== pageCategory) return
      
      if (!categoryMap.has(pageCategory)) {
        categoryMap.set(pageCategory, new Map())
      }
      
      const pageMap = categoryMap.get(pageCategory)!
      pageMap.set(row.page, {
        page: row.page,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })
    })

    // 前期間のデータをマージ
    const prevPageMap = new Map<string, PageData>()
    prevData.rows.forEach((row) => {
      if (!row.page) return
      const pageCategory = getCategoryFromUrl(row.page)
      if (!pageCategory) return
      if (category !== 'all' && category !== pageCategory) return
      
      prevPageMap.set(row.page, {
        page: row.page,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })
    })

    // カテゴリごとにデータを集計
    const result: CategoryData[] = []
    
    categoryMap.forEach((pageMap, cat) => {
      const pages: PageData[] = Array.from(pageMap.values())
        .map((currentPage) => {
          const prevPage = prevPageMap.get(currentPage.page)
          return {
            ...currentPage,
            prevClicks: prevPage?.clicks,
            prevImpressions: prevPage?.impressions,
            prevCtr: prevPage?.ctr,
            prevPosition: prevPage?.position,
          } as PageData & {
            prevClicks?: number
            prevImpressions?: number
            prevCtr?: number
            prevPosition?: number
          }
        })
        .sort((a, b) => b.clicks - a.clicks) // クリック数順にソート
        .slice(0, 20) // 上位20件

      const totalClicks = pages.reduce((sum, p) => sum + p.clicks, 0)
      const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0)
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
      const avgPosition = pages.reduce((sum, p) => sum + p.position, 0) / pages.length

      result.push({
        category: cat,
        pages: pages as any[],
        totalClicks,
        totalImpressions,
        avgCtr,
        avgPosition,
      })
    })

    return NextResponse.json({ categories: result })
  } catch (e) {
    console.error('Content analysis API error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Content analysis request failed' },
      { status: 500 }
    )
  }
}

