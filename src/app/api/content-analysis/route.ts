import { NextRequest, NextResponse } from 'next/server'
import { fetchGSCData } from '@/lib/gscClient'
import type { DateRange } from '@/lib/types'
import { getYearOverYearPeriod } from '@/lib/dateUtils'

interface ContentAnalysisRequest {
  dateRange: DateRange
  category?: 'articles' | 'products' | 'product-lists' | 'all'
  comparisonMode?: 'previous-period' | 'year-over-year'
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

// URLパターンでカテゴリを判定（フルURLと相対パスの両方に対応）
function getCategoryFromUrl(url: string): 'articles' | 'products' | 'product-lists' | null {
  // フルURLの場合はパス部分を抽出
  let path = url
  try {
    const urlObj = new URL(url)
    path = urlObj.pathname
  } catch {
    // URL解析に失敗した場合はそのまま使用（相対パスの可能性）
    path = url
  }
  
  if (path.includes('/magazine/article/')) {
    return 'articles'
  }
  if (path.includes('/shop/g/')) {
    return 'products'
  }
  if (path.includes('/shop/c/')) {
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
    const { dateRange, category = 'all', comparisonMode = 'year-over-year' } = body

    console.log('[Content Analysis API] Request received:', {
      dateRange,
      category,
      comparisonMode,
    })

    if (!dateRange.startDate || !dateRange.endDate) {
      console.error('[Content Analysis API] Validation error: startDate and endDate are required')
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

    console.log(`Content analysis: Fetched ${currentData.rows.length} pages for current period`)

    // 比較期間のデータを取得
    const prevDateRange = comparisonMode === 'year-over-year'
      ? getYearOverYearPeriod(dateRange.startDate, dateRange.endDate)
      : getPreviousDateRange(dateRange)
    const prevData = await fetchGSCData({
      startDate: prevDateRange.startDate,
      endDate: prevDateRange.endDate,
      dimensions: ['page'],
      rowLimit: 10000,
    })

    console.log(`Content analysis: Fetched ${prevData.rows.length} pages for previous period`)

    // ページデータをカテゴリごとにグループ化
    const categoryMap = new Map<string, Map<string, PageData>>()
    let matchedCount = 0
    let unmatchedCount = 0
    
    // 現在期間のデータを処理
    currentData.rows.forEach((row) => {
      if (!row.page) return
      
      const pageCategory = getCategoryFromUrl(row.page)
      if (!pageCategory) {
        unmatchedCount++
        return
      }
      
      // カテゴリでフィルタリング
      if (category !== 'all' && category !== pageCategory) return
      
      matchedCount++
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

    console.log(`Content analysis: Matched ${matchedCount} pages, unmatched ${unmatchedCount} pages`)

    // 比較期間（前年同時期または前期間）のデータをマージ
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

    console.log(`[Content Analysis API] Successfully processed ${result.length} categories`)
    return NextResponse.json({ categories: result })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Content analysis request failed'
    const errorStack = e instanceof Error ? e.stack : undefined
    console.error('[Content Analysis API] Error:', errorMessage)
    if (errorStack) {
      console.error('[Content Analysis API] Error stack:', errorStack)
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

