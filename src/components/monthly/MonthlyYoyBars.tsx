'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyYoyKpi } from '@/lib/monthlyChartsTypes'
import { formatMonthLabel } from '@/lib/monthlyReportSections'

function formatValue(value: number, format: MonthlyYoyKpi['format']): string {
  if (format === 'currency') return `¥${Math.round(value).toLocaleString()}`
  if (format === 'percent') return `${value.toFixed(2)}%`
  return value.toLocaleString()
}

export default function MonthlyYoyBars({
  monthKey,
  yoyMonthKey,
  kpis,
}: {
  monthKey: string
  yoyMonthKey: string
  kpis: MonthlyYoyKpi[]
}) {
  const currentLabel = formatMonthLabel(monthKey)
  const yoyLabel = formatMonthLabel(yoyMonthKey)
  const data = kpis.map((k) => ({
    name: k.label,
    current: k.current,
    previous: k.previous,
    format: k.format,
    percentChange: k.percentChange,
  }))

  return (
    <div className="border-y border-line py-4">
      <p className="m-0 mb-3 text-sm text-muted">
        前年同月比（{currentLabel} vs {yoyLabel}）
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 12, fill: '#666' }} />
          <Tooltip
            formatter={(value: number, name: string, item) => {
              const fmt = (item?.payload as { format?: MonthlyYoyKpi['format'] })?.format ?? 'number'
              const label = name === 'current' ? currentLabel : yoyLabel
              return [formatValue(value, fmt), label]
            }}
          />
          <Legend
            formatter={(value) => (value === 'current' ? currentLabel : yoyLabel)}
          />
          <Bar dataKey="previous" fill="#bbbbbb" name="previous" />
          <Bar dataKey="current" fill="#111111" name="current" />
        </BarChart>
      </ResponsiveContainer>
      <ul className="m-0 mt-2 grid gap-1 list-none p-0 text-sm text-muted">
        {kpis.map((k) => {
          const pct =
            k.percentChange == null
              ? '—'
              : `${k.percentChange >= 0 ? '+' : ''}${k.percentChange.toFixed(1)}%`
          return (
            <li key={k.id}>
              {k.label}: {formatValue(k.current, k.format)}（前年 {formatValue(k.previous, k.format)} / {pct}）
            </li>
          )
        })}
      </ul>
    </div>
  )
}
