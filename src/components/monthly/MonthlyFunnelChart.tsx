'use client'

import type { MonthlyFunnelSnapshot } from '@/lib/monthlyChartsTypes'
import { formatMonthLabel } from '@/lib/monthlyReportSections'

function FunnelColumn({
  title,
  snapshot,
}: {
  title: string
  snapshot: MonthlyFunnelSnapshot
}) {
  const max = Math.max(...snapshot.steps.map((s) => s.value), 1)
  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm font-semibold text-ink">{title}</p>
      {snapshot.steps.map((step) => {
        const widthPct = Math.max(8, (step.value / max) * 100)
        return (
          <div key={step.id} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink">{step.label}</span>
              <span className="text-muted tabular-nums">
                {step.value.toLocaleString()}
                {step.id !== snapshot.steps[0]?.id && (
                  <span className="ml-2">継続 {step.continueRate.toFixed(1)}%</span>
                )}
              </span>
            </div>
            <div className="h-3 w-full bg-[#f0f0f0]">
              <div className="h-3 bg-ink" style={{ width: `${widthPct}%` }} />
            </div>
          </div>
        )
      })}
      <p className="m-0 text-sm text-muted">
        全体CVR（セッション→購入）: {snapshot.overallConversionRate.toFixed(2)}%
      </p>
    </div>
  )
}

export default function MonthlyFunnelChart({
  monthKey,
  yoyMonthKey,
  current,
  yearAgo,
}: {
  monthKey: string
  yoyMonthKey: string
  current: MonthlyFunnelSnapshot
  yearAgo: MonthlyFunnelSnapshot
}) {
  return (
    <div className="grid gap-8 border-y border-line py-4 md:grid-cols-2">
      <FunnelColumn title={formatMonthLabel(monthKey)} snapshot={current} />
      <FunnelColumn title={formatMonthLabel(yoyMonthKey)} snapshot={yearAgo} />
    </div>
  )
}
