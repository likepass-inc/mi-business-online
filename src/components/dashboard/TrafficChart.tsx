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
  transactions: number
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
            metrics: ['sessions', 'transactions'],
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
          transactions: row.transactions || 0,
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
      <div className="h-64 flex items-center justify-center border-y border-line">
        <p className="m-0 text-muted">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-64 flex items-center justify-center border-y border-line">
        <p className="m-0 text-danger">エラー: {error}</p>
      </div>
    )
  }

  return (
    <div className="border-y border-line py-4">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#666' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#666' }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#666' }} />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="sessions"
            stroke="#111111"
            strokeWidth={2}
            name="セッション"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="transactions"
            stroke="#ff322d"
            strokeWidth={2}
            name="トランザクション"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

