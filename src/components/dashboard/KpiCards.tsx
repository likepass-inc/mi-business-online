'use client'

import { useEffect, useState } from 'react'
import type { DateRange } from '@/lib/types'
import { getYearOverYearPeriod } from '@/lib/dateUtils'

interface KpiCardsProps {
  dateRange: DateRange
}

interface KpiData {
  sessions: number
  transactions: number
  cvr: number
  organicSessions: number
  gscClicks: number
  gscImpressions: number
  gscCtr: number
  gscPosition: number
  prevSessions: number
  prevTransactions: number
  prevCvr: number
  prevOrganicSessions: number
  prevGscClicks: number
  prevGscImpressions: number
  prevGscCtr: number
  prevGscPosition: number
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

type ComparisonMode = 'previous-period' | 'year-over-year'

// 前期間対比を計算
function calculateComparison(current: number, previous: number): { diff: number; percent: number | null } {
  const diff = current - previous
  const percent = previous !== 0 ? ((diff / previous) * 100) : null
  return { diff, percent }
}

// 前期間対比表示コンポーネント
function ComparisonDisplay({ current, previous, isLowerBetter = false }: { current: number; previous: number; isLowerBetter?: boolean }) {
  const { diff, percent } = calculateComparison(current, previous)
  if (previous === 0) {
    return <p className="text-xs text-gray-500 mt-1">-</p>
  }
  
  // 平均ポジションの場合は、数値が小さい方が良いので色分けを逆にする
  const isPositive = isLowerBetter ? diff < 0 : diff > 0
  const isNegative = isLowerBetter ? diff > 0 : diff < 0
  const colorClass = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
  const sign = diff > 0 ? '+' : ''
  
  return (
    <p className={`text-xs ${colorClass} mt-1`}>
      {sign}{diff.toLocaleString()} ({percent !== null ? `${sign}${percent.toFixed(2)}%` : '-'})
    </p>
  )
}

export default function KpiCards({ dateRange }: KpiCardsProps) {
  const [kpiData, setKpiData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('year-over-year')

  useEffect(() => {
    async function fetchKpis() {
      try {
        setLoading(true)
        setError(null)

        const prevDateRange = comparisonMode === 'year-over-year'
          ? getYearOverYearPeriod(dateRange.startDate, dateRange.endDate)
          : getPreviousDateRange(dateRange)

        // 全体のセッションとトランザクション
        const allResponse = await fetch('/api/ga4', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateRange,
            metrics: ['sessions', 'transactions'],
          }),
        })

        if (!allResponse.ok) {
          throw new Error('Failed to fetch GA4 data')
        }

        const allData = await allResponse.json()
        const totalSessions = allData.rows.reduce((sum: number, row: any) => sum + (row.sessions || 0), 0)
        const totalTransactions = allData.rows.reduce((sum: number, row: any) => sum + (row.transactions || 0), 0)

        // 自然検索のセッション
        const organicResponse = await fetch('/api/ga4', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateRange,
            metrics: ['sessions'],
            filters: [
              {
                field: 'sessionDefaultChannelGroup',
                operator: 'EXACT',
                value: 'Organic Search',
              },
            ],
          }),
        })

        if (!organicResponse.ok) {
          throw new Error('Failed to fetch organic sessions')
        }

        const organicData = await organicResponse.json()
        const organicSessions = organicData.rows.reduce((sum: number, row: any) => sum + (row.sessions || 0), 0)

        // 前期間のGA4データ取得
        let prevSessions = 0
        let prevTransactions = 0
        let prevOrganicSessions = 0

        try {
          const prevAllResponse = await fetch('/api/ga4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dateRange: prevDateRange,
              metrics: ['sessions', 'transactions'],
            }),
          })

          if (prevAllResponse.ok) {
            const prevAllData = await prevAllResponse.json()
            prevSessions = prevAllData.rows.reduce((sum: number, row: any) => sum + (row.sessions || 0), 0)
            prevTransactions = prevAllData.rows.reduce((sum: number, row: any) => sum + (row.transactions || 0), 0)
          }

          const prevOrganicResponse = await fetch('/api/ga4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dateRange: prevDateRange,
              metrics: ['sessions'],
              filters: [
                {
                  field: 'sessionDefaultChannelGroup',
                  operator: 'EXACT',
                  value: 'Organic Search',
                },
              ],
            }),
          })

          if (prevOrganicResponse.ok) {
            const prevOrganicData = await prevOrganicResponse.json()
            prevOrganicSessions = prevOrganicData.rows.reduce((sum: number, row: any) => sum + (row.sessions || 0), 0)
          }
        } catch (prevErr) {
          console.error('Previous period GA4 data fetch error:', prevErr)
        }

        // GSCデータの取得
        let gscClicks = 0
        let gscImpressions = 0
        let gscCtr = 0
        let gscPosition = 0
        let prevGscClicks = 0
        let prevGscImpressions = 0
        let prevGscCtr = 0
        let prevGscPosition = 0

        try {
          const gscResponse = await fetch('/api/gsc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
              rowLimit: 10000,
            }),
          })

          if (gscResponse.ok) {
            const gscData = await gscResponse.json()
            if (gscData.rows && gscData.rows.length > 0) {
              gscClicks = gscData.rows.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0)
              gscImpressions = gscData.rows.reduce((sum: number, row: any) => sum + (row.impressions || 0), 0)
              
              // CTRは加重平均を計算（合計clicks / 合計impressions * 100）
              gscCtr = gscImpressions > 0 ? (gscClicks / gscImpressions) * 100 : 0
              
              // 平均ポジションは加重平均を計算
              const positionSum = gscData.rows.reduce(
                (sum: number, row: any) => sum + (row.position || 0) * (row.impressions || 0),
                0
              )
              gscPosition = gscImpressions > 0 ? positionSum / gscImpressions : 0
            }
          }

          // 前期間のGSCデータ取得
          const prevGscResponse = await fetch('/api/gsc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate: prevDateRange.startDate,
              endDate: prevDateRange.endDate,
              rowLimit: 10000,
            }),
          })

          if (prevGscResponse.ok) {
            const prevGscData = await prevGscResponse.json()
            if (prevGscData.rows && prevGscData.rows.length > 0) {
              prevGscClicks = prevGscData.rows.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0)
              prevGscImpressions = prevGscData.rows.reduce((sum: number, row: any) => sum + (row.impressions || 0), 0)
              
              prevGscCtr = prevGscImpressions > 0 ? (prevGscClicks / prevGscImpressions) * 100 : 0
              
              const prevPositionSum = prevGscData.rows.reduce(
                (sum: number, row: any) => sum + (row.position || 0) * (row.impressions || 0),
                0
              )
              prevGscPosition = prevGscImpressions > 0 ? prevPositionSum / prevGscImpressions : 0
            }
          }
        } catch (gscErr) {
          // GSCデータ取得エラーは無視（GA4データは表示する）
          console.error('GSC data fetch error:', gscErr)
        }

        const cvr = totalSessions > 0 ? (totalTransactions / totalSessions) * 100 : 0
        const prevCvr = prevSessions > 0 ? (prevTransactions / prevSessions) * 100 : 0

        setKpiData({
          sessions: totalSessions,
          transactions: totalTransactions,
          cvr,
          organicSessions,
          gscClicks,
          gscImpressions,
          gscCtr,
          gscPosition,
          prevSessions,
          prevTransactions,
          prevCvr,
          prevOrganicSessions,
          prevGscClicks,
          prevGscImpressions,
          prevGscCtr,
          prevGscPosition,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchKpis()
  }, [dateRange, comparisonMode])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        エラー: {error}
      </div>
    )
  }

  if (!kpiData) {
    return null
  }

  return (
    <div>
      {/* 比較モード切り替えボタン */}
      <div className="mb-4 flex justify-end">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">セッション</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.sessions.toLocaleString()}
        </p>
        <ComparisonDisplay current={kpiData.sessions} previous={kpiData.prevSessions} />
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">トランザクション</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.transactions.toLocaleString()}
        </p>
        <ComparisonDisplay current={kpiData.transactions} previous={kpiData.prevTransactions} />
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">CVR</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.cvr.toFixed(2)}%
        </p>
        <ComparisonDisplay current={kpiData.cvr} previous={kpiData.prevCvr} />
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">自然検索セッション</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.organicSessions.toLocaleString()}
        </p>
        <ComparisonDisplay current={kpiData.organicSessions} previous={kpiData.prevOrganicSessions} />
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">GSC クリック数</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.gscClicks.toLocaleString()}
        </p>
        <ComparisonDisplay current={kpiData.gscClicks} previous={kpiData.prevGscClicks} />
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">GSC インプレッション数</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.gscImpressions.toLocaleString()}
        </p>
        <ComparisonDisplay current={kpiData.gscImpressions} previous={kpiData.prevGscImpressions} />
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">GSC CTR</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.gscCtr.toFixed(2)}%
        </p>
        <ComparisonDisplay current={kpiData.gscCtr} previous={kpiData.prevGscCtr} />
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">GSC 平均ポジション</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.gscPosition.toFixed(1)}
        </p>
        <ComparisonDisplay current={kpiData.gscPosition} previous={kpiData.prevGscPosition} isLowerBetter={true} />
      </div>
      </div>
    </div>
  )
}

