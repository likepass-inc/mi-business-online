'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SiteSearchEffectSnapshot } from '@/lib/monthlyChartsTypes'
import { formatMonthLabel } from '@/lib/monthlyReportSections'

function eventCount(
  snap: SiteSearchEffectSnapshot,
  key: 'open' | 'submit' | 'resultClick' | 'productClick'
): number {
  const ev = snap.ga4?.events?.[key]
  if (!ev || typeof ev !== 'object') return 0
  return Number(ev.eventCount) || 0
}

function pctChange(current: number, previous: number): string {
  if (!previous) return '—'
  const pct = ((current - previous) / previous) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

function KpiBarChart({
  label,
  current,
  previous,
  currentLabel,
  yoyLabel,
}: {
  label: string
  current: number
  previous: number
  currentLabel: string
  yoyLabel: string
}) {
  const data = [
    { name: yoyLabel, value: previous, fill: '#bbbbbb' },
    { name: currentLabel, value: current, fill: '#111111' },
  ]

  return (
    <div>
      <p className="m-0 mb-1 text-sm font-semibold text-ink">{label}</p>
      <p className="m-0 mb-2 text-sm text-muted">
        {current.toLocaleString()}
        <span className="ml-2">
          （前年 {previous.toLocaleString()} / {pctChange(current, previous)}）
        </span>
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
          <YAxis tick={{ fontSize: 11, fill: '#666' }} width={40} />
          <Tooltip formatter={(value: number) => value.toLocaleString()} />
          <Bar dataKey="value" name={label}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function MonthlyAiSearchSummary({
  monthKey,
  yoyMonthKey,
  current,
  yearAgo,
}: {
  monthKey: string
  yoyMonthKey: string
  current: SiteSearchEffectSnapshot
  yearAgo: SiteSearchEffectSnapshot
}) {
  const currentLabel = formatMonthLabel(monthKey)
  const yoyLabel = formatMonthLabel(yoyMonthKey)

  const kpis = [
    { id: 'total', label: '総検索数', current: current.totalSearches, previous: yearAgo.totalSearches },
    { id: 'unique', label: 'ユニークQ', current: current.uniqueQueries, previous: yearAgo.uniqueQueries },
    {
      id: 'submit',
      label: '検索実行',
      current: eventCount(current, 'submit'),
      previous: eventCount(yearAgo, 'submit'),
    },
    {
      id: 'resultClick',
      label: '結果クリック',
      current: eventCount(current, 'resultClick'),
      previous: eventCount(yearAgo, 'resultClick'),
    },
  ]

  const contrib = current.ga4?.contribution
  const sharePct =
    contrib?.cvSharePercent != null ? Number(contrib.cvSharePercent) : null
  const shareData =
    sharePct != null
      ? [
          { name: '検索利用者', value: Math.max(0, sharePct), fill: '#111111' },
          { name: 'その他', value: Math.max(0, 100 - sharePct), fill: '#dddddd' },
        ]
      : []

  const daily = (current.ga4?.daily || []).map((d) => ({
    date: String(d.date || '').slice(5),
    searches: Number(d.submit) || 0,
  }))

  return (
    <div className="grid gap-6 border-y border-line py-4">
      <div>
        <p className="m-0 mb-4 text-sm text-muted">
          AIサイト内検索 KPI（{currentLabel} vs {yoyLabel}）
        </p>
        <div className="grid gap-8 md:grid-cols-2">
          {kpis.map((kpi) => (
            <KpiBarChart
              key={kpi.id}
              label={kpi.label}
              current={kpi.current}
              previous={kpi.previous}
              currentLabel={currentLabel}
              yoyLabel={yoyLabel}
            />
          ))}
        </div>
      </div>

      {contrib?.contributionAvailable && (
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
            <div className="border-t border-line pt-3">
              <p className="m-0 text-xs text-muted">検索利用者の購入シェア</p>
              <p className="m-0 text-xl font-semibold tabular-nums">
                {sharePct != null ? `${sharePct.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="border-t border-line pt-3">
              <p className="m-0 text-xs text-muted">検索利用者の売上</p>
              <p className="m-0 text-xl font-semibold tabular-nums">
                {contrib.searchUsers?.purchaseRevenue != null
                  ? `¥${Math.round(Number(contrib.searchUsers.purchaseRevenue)).toLocaleString()}`
                  : '—'}
              </p>
            </div>
            <div className="border-t border-line pt-3">
              <p className="m-0 text-xs text-muted">検索利用者の購入件数</p>
              <p className="m-0 text-xl font-semibold tabular-nums">
                {contrib.searchUsers?.ecommercePurchases != null
                  ? Number(contrib.searchUsers.ecommercePurchases).toLocaleString()
                  : '—'}
              </p>
            </div>
          </div>
          {shareData.length > 0 && (
            <div>
              <p className="m-0 mb-2 text-sm text-muted">購入シェア構成</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={shareData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {shareData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {daily.length > 1 && (
        <div>
          <p className="m-0 mb-3 text-sm text-muted">日次検索数（当月）</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={daily} margin={{ top: 20, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} interval={2} />
              <YAxis
                tick={{ fontSize: 11, fill: '#666' }}
                tickFormatter={(v) => Number(v).toLocaleString()}
                width={40}
              />
              <Tooltip formatter={(value: number) => value.toLocaleString()} />
              <Bar dataKey="searches" name="検索数" fill="#111111">
                <LabelList
                  dataKey="searches"
                  position="top"
                  // 31日分は2日おきに件数を表示
                  content={(props) => {
                    const { x, y, width, value, index } = props
                    if (
                      x == null ||
                      y == null ||
                      typeof value !== 'number' ||
                      value <= 0 ||
                      (typeof index === 'number' && index % 2 !== 0)
                    ) {
                      return null
                    }
                    const cx = Number(x) + Number(width ?? 0) / 2
                    return (
                      <text
                        x={cx}
                        y={Number(y) - 4}
                        textAnchor="middle"
                        fill="#333"
                        fontSize={9}
                      >
                        {value.toLocaleString()}
                      </text>
                    )
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
