'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

function formatAxisTick(value: number, format: MonthlyYoyKpi['format']): string {
  if (format === 'currency') {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`
    return String(Math.round(value))
  }
  if (format === 'percent') return `${value.toFixed(1)}%`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`
  return value.toLocaleString()
}

function KpiBarChart({
  kpi,
  currentLabel,
  yoyLabel,
}: {
  kpi: MonthlyYoyKpi
  currentLabel: string
  yoyLabel: string
}) {
  const data = [
    { name: yoyLabel, value: kpi.previous, fill: '#bbbbbb' },
    { name: currentLabel, value: kpi.current, fill: '#111111' },
  ]
  const pct =
    kpi.percentChange == null
      ? '—'
      : `${kpi.percentChange >= 0 ? '+' : ''}${kpi.percentChange.toFixed(1)}%`

  return (
    <div>
      <p className="m-0 mb-1 text-sm font-semibold text-ink">{kpi.label}</p>
      <p className="m-0 mb-2 text-sm text-muted">
        {formatValue(kpi.current, kpi.format)}
        <span className="ml-2">
          （前年 {formatValue(kpi.previous, kpi.format)} / {pct}）
        </span>
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
          <YAxis
            tick={{ fontSize: 11, fill: '#666' }}
            tickFormatter={(v) => formatAxisTick(Number(v), kpi.format)}
            width={48}
          />
          <Tooltip
            formatter={(value: number) => [formatValue(value, kpi.format), kpi.label]}
            labelFormatter={(label) => String(label)}
          />
          <Bar dataKey="value" name={kpi.label}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
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

  return (
    <div className="border-y border-line py-4">
      <p className="m-0 mb-4 text-sm text-muted">
        前年同月比（{currentLabel} vs {yoyLabel}）
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        {kpis.map((kpi) => (
          <KpiBarChart
            key={kpi.id}
            kpi={kpi}
            currentLabel={currentLabel}
            yoyLabel={yoyLabel}
          />
        ))}
      </div>
    </div>
  )
}
