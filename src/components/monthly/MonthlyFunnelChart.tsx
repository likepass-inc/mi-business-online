'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyFunnelSnapshot } from '@/lib/monthlyChartsTypes'
import { formatMonthLabel } from '@/lib/monthlyReportSections'

function FunnelColumn({
  title,
  snapshot,
}: {
  title: string
  snapshot: MonthlyFunnelSnapshot
}) {
  const firstId = snapshot.steps[0]?.id
  const data = snapshot.steps.map((step) => ({
    name: step.label,
    value: step.value,
    continueRate: step.continueRate,
    isFirst: step.id === firstId,
  }))

  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm font-semibold text-ink">{title}</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#666' }}
            tickFormatter={(v) => Number(v).toLocaleString()}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fontSize: 11, fill: '#666' }}
          />
          <Tooltip
            formatter={(value: number, _name, item) => {
              const rate = item?.payload?.continueRate
              const isFirst = item?.payload?.isFirst
              if (!isFirst && rate != null) {
                return [
                  `${value.toLocaleString()}（継続 ${Number(rate).toFixed(1)}%）`,
                  '件数',
                ]
              }
              return [value.toLocaleString(), '件数']
            }}
          />
          <Bar dataKey="value" name="件数" fill="#111111" barSize={22} />
        </BarChart>
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
