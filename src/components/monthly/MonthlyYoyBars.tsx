'use client'

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

  return (
    <div className="border-y border-line py-4">
      <p className="m-0 mb-4 text-sm text-muted">
        前年同月比（{currentLabel} vs {yoyLabel}）
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => {
          const pct =
            kpi.percentChange == null
              ? '—'
              : `${kpi.percentChange >= 0 ? '+' : ''}${kpi.percentChange.toFixed(1)}%`
          return (
            <div key={kpi.id} className="border-t border-line pt-3">
              <p className="m-0 text-xs text-muted">{kpi.label}</p>
              <p className="m-0 mt-1 text-xl font-semibold tabular-nums text-ink">
                {formatValue(kpi.current, kpi.format)}
              </p>
              <p className="m-0 mt-1 text-sm text-muted">
                前年 {formatValue(kpi.previous, kpi.format)} / {pct}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
