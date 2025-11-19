'use client'

import { useEffect, useState } from 'react'
import type { DateRange } from '@/lib/types'

interface ContentPopularityAnalysisProps {
  dateRange: DateRange
}

interface PageData {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  prevClicks?: number
  prevImpressions?: number
  prevCtr?: number
  prevPosition?: number
}

interface CategoryData {
  category: string
  pages: PageData[]
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
}

type CategoryType = 'articles' | 'products' | 'product-lists'
type ComparisonMode = 'previous-period' | 'year-over-year'

// 比較対比（前年同時期または前期間）を計算
function calculateComparison(current: number, previous: number): { diff: number; percent: number | null } {
  const diff = current - previous
  const percent = previous !== 0 ? ((diff / previous) * 100) : null
  return { diff, percent }
}

// 比較対比表示コンポーネント
function ComparisonCell({ current, previous, isLowerBetter = false, isPercentage = false, decimalPlaces = 0 }: { current: number; previous?: number; isLowerBetter?: boolean; isPercentage?: boolean; decimalPlaces?: number }) {
  if (previous === undefined) {
    const formatCurrent = () => {
      if (isPercentage) return `${current.toFixed(2)}%`
      if (decimalPlaces > 0) return current.toFixed(decimalPlaces)
      return current.toLocaleString()
    }
    return (
      <div className="text-xs">
        <div className="text-gray-900">{formatCurrent()}</div>
        <div className="text-gray-400">-</div>
      </div>
    )
  }
  
  const { diff, percent } = calculateComparison(current, previous)
  const isPositive = isLowerBetter ? diff < 0 : diff > 0
  const isNegative = isLowerBetter ? diff > 0 : diff < 0
  const colorClass = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
  const sign = diff > 0 ? '+' : ''
  
  const formatValue = (val: number) => {
    if (isPercentage) return `${val.toFixed(2)}%`
    if (decimalPlaces > 0) return val.toFixed(decimalPlaces)
    return val.toLocaleString()
  }
  const formatDiff = (val: number) => {
    if (isPercentage) return `${sign}${val.toFixed(2)}%`
    if (decimalPlaces > 0) return `${sign}${val.toFixed(decimalPlaces)}`
    return `${sign}${val.toLocaleString()}`
  }
  
  return (
    <div className="text-xs">
      <div className="text-gray-900">{formatValue(current)}</div>
      <div className={colorClass}>
        {formatDiff(diff)} ({percent !== null ? `${sign}${percent.toFixed(1)}%` : '-'})
      </div>
    </div>
  )
}

// カテゴリ名を日本語に変換
function getCategoryName(category: string): string {
  const categoryMap: Record<string, string> = {
    articles: '記事',
    products: '商品',
    'product-lists': '商品一覧',
  }
  return categoryMap[category] || category
}

// ページURLを短縮表示
function shortenUrl(url: string): string {
  if (url.startsWith('https://business.mistore.jp')) {
    return url.replace('https://business.mistore.jp', '')
  }
  if (url.startsWith('http://business.mistore.jp')) {
    return url.replace('http://business.mistore.jp', '')
  }
  return url
}

// URLを正規化（フルURLか相対パスかを判定して適切なURLを返す）
function normalizeUrl(url: string): string {
  // 既にフルURLの場合はそのまま返す
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  // 相対パスの場合はドメインを追加
  return `https://business.mistore.jp${url.startsWith('/') ? url : '/' + url}`
}

export default function ContentPopularityAnalysis({ dateRange }: ContentPopularityAnalysisProps) {
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [activeCategory, setActiveCategory] = useState<CategoryType | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'clicks' | 'impressions' | 'ctr' | 'position'>('clicks')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('year-over-year')

  useEffect(() => {
    async function fetchContentData() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/content-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateRange,
            category: 'all',
            comparisonMode,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch content data')
        }

        const data = await response.json()
        setCategories(data.categories || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchContentData()
  }, [dateRange, comparisonMode])

  // アクティブなカテゴリのデータを取得
  const activeCategoryData = activeCategory === 'all' 
    ? categories 
    : categories.filter(cat => cat.category === activeCategory)

  // ソート処理
  const sortedPages = activeCategoryData.flatMap(cat => cat.pages).sort((a, b) => {
    let aValue: number
    let bValue: number
    
    switch (sortBy) {
      case 'clicks':
        aValue = a.clicks
        bValue = b.clicks
        break
      case 'impressions':
        aValue = a.impressions
        bValue = b.impressions
        break
      case 'ctr':
        aValue = a.ctr * 100
        bValue = b.ctr * 100
        break
      case 'position':
        aValue = a.position
        bValue = b.position
        break
      default:
        aValue = a.clicks
        bValue = b.clicks
    }
    
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
  })

  const handleSort = (column: 'clicks' | 'impressions' | 'ctr' | 'position') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">データを読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-red-500">エラー: {error}</div>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">データがありません</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 比較モード切り替えボタン */}
      <div className="px-4 pt-4 pb-2 flex justify-end">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setComparisonMode('year-over-year')}
            className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
              comparisonMode === 'year-over-year'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            前年同時期対比
          </button>
          <button
            type="button"
            onClick={() => setComparisonMode('previous-period')}
            className={`px-4 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b ${
              comparisonMode === 'previous-period'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            前期間対比
          </button>
        </div>
      </div>
      {/* タブ */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${
              activeCategory === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            すべて
          </button>
          {categories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category as CategoryType)}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeCategory === cat.category
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {getCategoryName(cat.category)}
            </button>
          ))}
        </nav>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                順位
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ページURL
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('clicks')}
              >
                クリック数
                {sortBy === 'clicks' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('impressions')}
              >
                インプレッション
                {sortBy === 'impressions' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('ctr')}
              >
                CTR
                {sortBy === 'ctr' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('position')}
              >
                平均ポジション
                {sortBy === 'position' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedPages.map((page, index) => (
              <tr key={page.page} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {index + 1}
                </td>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={normalizeUrl(page.page)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {shortenUrl(page.page)}
                  </a>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ComparisonCell current={page.clicks} previous={page.prevClicks} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ComparisonCell current={page.impressions} previous={page.prevImpressions} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ComparisonCell 
                    current={page.ctr * 100} 
                    previous={page.prevCtr ? page.prevCtr * 100 : undefined} 
                    isPercentage 
                    decimalPlaces={2}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ComparisonCell 
                    current={page.position} 
                    previous={page.prevPosition} 
                    isLowerBetter 
                    decimalPlaces={1}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* サマリー */}
      {activeCategory !== 'all' && activeCategoryData.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">総クリック数</div>
              <div className="text-lg font-semibold text-gray-900">
                {activeCategoryData[0].totalClicks.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500">総インプレッション</div>
              <div className="text-lg font-semibold text-gray-900">
                {activeCategoryData[0].totalImpressions.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500">平均CTR</div>
              <div className="text-lg font-semibold text-gray-900">
                {activeCategoryData[0].avgCtr.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-gray-500">平均ポジション</div>
              <div className="text-lg font-semibold text-gray-900">
                {activeCategoryData[0].avgPosition.toFixed(1)}位
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

