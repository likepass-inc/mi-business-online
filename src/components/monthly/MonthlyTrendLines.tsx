'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyTrendSeries } from '@/lib/buildMonthlyTrendSeries'

const CHARTS: Array<{
  title: string
  dataKey: string
  color: string
  get: (p: MonthlyTrendSeries[number]) => number
  format?: (n: number) => string
}> = [
  {
    title: 'GSC クリック',
    dataKey: 'clicks',
    color: '#111111',
    get: (p) => p.gsc.clicks,
  },
  {
    title: 'セッション',
    dataKey: 'sessions',
    color: '#ff322d',
    get: (p) => p.ga4.sessions,
  },
  {
    title: '購入完了',
    dataKey: 'transactions',
    color: '#1a5f7a',
    get: (p) => p.ga4.transactions,
  },
  {
    title: '売上',
    dataKey: 'revenue',
    color: '#5c4b3a',
    get: (p) => p.ga4.revenue,
    format: (n) => `¥${Math.round(n).toLocaleString()}`,
  },
]

export default function MonthlyTrendLines({
  trends,
  highlightMonthKey,
}: {
  trends: MonthlyTrendSeries
  highlightMonthKey: string
}) {
  return (
    <div className="grid gap-8 border-y border-line py-4 md:grid-cols-2">
      {CHARTS.map((chart) => {
        const data = trends.map((p) => ({
          label: p.label,
          monthKey: p.monthKey,
          value: chart.get(p),
          highlight: p.monthKey === highlightMonthKey,
        }))
        const fillId = `fill-${chart.dataKey}`
        return (
          <div key={chart.dataKey}>
            <p className="m-0 mb-2 text-sm font-semibold text-ink">{chart.title}</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={chart.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} interval={2} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#666' }}
                  tickFormatter={(v) =>
                    chart.format ? chart.format(Number(v)).replace(/¥/, '') : Number(v).toLocaleString()
                  }
                  width={56}
                />
                <Tooltip
                  formatter={(value: number) =>
                    chart.format ? chart.format(value) : value.toLocaleString()
                  }
                  labelFormatter={(label) => String(label)}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={chart.title}
                  stroke={chart.color}
                  strokeWidth={2}
                  fill={`url(#${fillId})`}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    if (cx == null || cy == null) return null
                    const r = payload?.highlight ? 5 : 3
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={payload?.highlight ? '#ff322d' : chart.color}
                        stroke="#fff"
                        strokeWidth={1}
                      />
                    )
                  }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}
