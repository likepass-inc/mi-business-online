'use client'

import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from 'recharts'
import type { MonthlyFunnelSnapshot } from '@/lib/monthlyChartsTypes'
import { formatMonthLabel } from '@/lib/monthlyReportSections'

const FUNNEL_COLORS = ['#111111', '#333333', '#555555', '#777777', '#999999']

function FunnelColumn({
  title,
  snapshot,
}: {
  title: string
  snapshot: MonthlyFunnelSnapshot
}) {
  const data = snapshot.steps.map((step, index) => ({
    name: step.label,
    value: step.value,
    continueRate: step.continueRate,
    fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
  }))

  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm font-semibold text-ink">{title}</p>
      <ResponsiveContainer width="100%" height={280}>
        <FunnelChart>
          <Tooltip
            formatter={(value: number, _name, item) => {
              const rate = item?.payload?.continueRate
              const label =
                rate != null && item?.payload?.name !== data[0]?.name
                  ? `${value.toLocaleString()}（継続 ${Number(rate).toFixed(1)}%）`
                  : value.toLocaleString()
              return [label, item?.payload?.name ?? '']
            }}
          />
          <Funnel
            dataKey="value"
            data={data}
            isAnimationActive={false}
            lastShapeType="rectangle"
          >
            <LabelList
              position="right"
              fill="#333"
              stroke="none"
              dataKey="name"
              style={{ fontSize: 12 }}
            />
            <LabelList
              position="center"
              fill="#fff"
              stroke="none"
              dataKey="value"
              formatter={(v) => (typeof v === 'number' ? v.toLocaleString() : String(v ?? ''))}
              style={{ fontSize: 11 }}
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
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
