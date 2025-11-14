'use client'

import { useEffect, useState } from 'react'
import type { DateRange } from '@/lib/types'

interface KpiCardsProps {
  dateRange: DateRange
}

interface KpiData {
  sessions: number
  conversions: number
  cvr: number
  organicSessions: number
}

export default function KpiCards({ dateRange }: KpiCardsProps) {
  const [kpiData, setKpiData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchKpis() {
      try {
        setLoading(true)
        setError(null)

        // 全体のセッションとコンバージョン
        const allResponse = await fetch('/api/ga4', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateRange,
            metrics: ['sessions', 'conversions'],
          }),
        })

        if (!allResponse.ok) {
          throw new Error('Failed to fetch GA4 data')
        }

        const allData = await allResponse.json()
        const totalSessions = allData.rows.reduce((sum: number, row: any) => sum + (row.sessions || 0), 0)
        const totalConversions = allData.rows.reduce((sum: number, row: any) => sum + (row.conversions || 0), 0)

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

        setKpiData({
          sessions: totalSessions,
          conversions: totalConversions,
          cvr: totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0,
          organicSessions,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchKpis()
  }, [dateRange])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">セッション</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.sessions.toLocaleString()}
        </p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">コンバージョン</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.conversions.toLocaleString()}
        </p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">CVR</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.cvr.toFixed(2)}%
        </p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 mb-2">自然検索セッション</h3>
        <p className="text-3xl font-bold text-gray-900">
          {kpiData.organicSessions.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

