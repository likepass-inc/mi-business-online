'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { DateRange } from '@/lib/types'

interface TrafficChartProps {
  dateRange: DateRange
}

interface ChartData {
  date: string
  sessions: number
  conversions: number
}

export default function TrafficChart({ dateRange }: TrafficChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchChartData() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/ga4', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateRange,
            metrics: ['sessions', 'conversions'],
            dimensions: ['date'],
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch chart data')
        }

        const data = await response.json()
        const formatted = data.rows.map((row: any) => ({
          date: row.date || '',
          sessions: row.sessions || 0,
          conversions: row.conversions || 0,
        }))

        setChartData(formatted.sort((a: ChartData, b: ChartData) => a.date.localeCompare(b.date)))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchChartData()
  }, [dateRange])

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="h-64 flex items-center justify-center">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="h-64 flex items-center justify-center text-red-600">
          エラー: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="sessions"
            stroke="#8884d8"
            strokeWidth={2}
            name="セッション"
          />
          <Line
            type="monotone"
            dataKey="conversions"
            stroke="#82ca9d"
            strokeWidth={2}
            name="コンバージョン"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

