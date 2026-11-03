'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyTrendSeries } from '@/lib/buildMonthlyTrendSeries'
import {
  MONTHLY_TREND_METRICS,
  type MonthlyTrendMetricDef,
} from '@/lib/monthlyTrendMetrics'

const ABSOLUTE_COLOR = '#111111'
const RATE_COLOR = '#1a5f7a'
const HIGHLIGHT_COLOR = '#ff322d'
const MUTED_BAR = '#666666'

function axisTick(metric: MonthlyTrendMetricDef, value: number): string {
  const formatted = metric.formatValue(value)
  return formatted.replace(/¥/, '').replace(/%$/, '')
}

function TrendChart({
  metric,
  trends,
  highlightMonthKey,
}: {
  metric: MonthlyTrendMetricDef
  trends: MonthlyTrendSeries
  highlightMonthKey: string
}) {
  const data = trends.map((p) => ({
    label: p.label,
    monthKey: p.monthKey,
    value: metric.getValue(p),
    highlight: p.monthKey === highlightMonthKey,
  }))
  const color = metric.kind === 'rate' ? RATE_COLOR : ABSOLUTE_COLOR
  const fillId = `fill-${metric.id}`
  const yReversed = metric.invertY === true

  return (
    <div>
      <p className="m-0 mb-2 text-sm font-semibold text-ink">{metric.title}</p>
      {metric.invertY && (
        <p className="m-0 mb-1 text-xs text-muted">※ 順位は数値が小さいほど良い（上方向）</p>
      )}
      <ResponsiveContainer width="100%" height={220}>
        {metric.kind === 'absolute' ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} interval={2} />
            <YAxis
              tick={{ fontSize: 11, fill: '#666' }}
              tickFormatter={(v) => axisTick(metric, Number(v))}
              width={56}
            />
            <Tooltip
              formatter={(value: number) => metric.formatValue(value)}
              labelFormatter={(label) => String(label)}
            />
            <Legend />
            <Bar dataKey="value" name={metric.title}>
              {data.map((entry) => (
                <Cell
                  key={entry.monthKey}
                  fill={entry.highlight ? HIGHLIGHT_COLOR : MUTED_BAR}
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} interval={2} />
            <YAxis
              reversed={yReversed}
              tick={{ fontSize: 11, fill: '#666' }}
              tickFormatter={(v) => axisTick(metric, Number(v))}
              width={56}
            />
            <Tooltip
              formatter={(value: number) => metric.formatValue(value)}
              labelFormatter={(label) => String(label)}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="value"
              name={metric.title}
              stroke={color}
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
                    fill={payload?.highlight ? HIGHLIGHT_COLOR : color}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                )
              }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

export default function MonthlyTrendLines({
  trends,
  highlightMonthKey,
}: {
  trends: MonthlyTrendSeries
  highlightMonthKey: string
}) {
  return (
    <div className="grid gap-8 border-y border-line py-4 md:grid-cols-2">
      {MONTHLY_TREND_METRICS.map((metric) => (
        <TrendChart
          key={metric.id}
          metric={metric}
          trends={trends}
          highlightMonthKey={highlightMonthKey}
        />
      ))}
    </div>
  )
}
