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

  const kpiData = [
    { name: '総検索数', current: current.totalSearches, previous: yearAgo.totalSearches },
    { name: 'ユニークQ', current: current.uniqueQueries, previous: yearAgo.uniqueQueries },
    {
      name: '検索実行',
      current: eventCount(current, 'submit'),
      previous: eventCount(yearAgo, 'submit'),
    },
    {
      name: '結果クリック',
      current: eventCount(current, 'resultClick'),
      previous: eventCount(yearAgo, 'resultClick'),
    },
  ]

  const contrib = current.ga4?.contribution
  const daily = (current.ga4?.daily || []).map((d) => ({
    date: String(d.date || '').slice(5),
    searches: Number(d.searches) || 0,
    searchRevenue: Number(d.searchRevenue) || 0,
  }))

  return (
    <div className="grid gap-6 border-y border-line py-4">
      <div>
        <p className="m-0 mb-3 text-sm text-muted">
          AIサイト内検索 KPI（{currentLabel} vs {yoyLabel}）
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={kpiData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#666' }} />
            <YAxis tick={{ fontSize: 12, fill: '#666' }} />
            <Tooltip />
            <Legend
              formatter={(value) => (value === 'current' ? currentLabel : yoyLabel)}
            />
            <Bar dataKey="previous" fill="#bbbbbb" name="previous" />
            <Bar dataKey="current" fill="#111111" name="current" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {contrib?.contributionAvailable && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="border-t border-line pt-3">
            <p className="m-0 text-xs text-muted">検索利用者の購入シェア</p>
            <p className="m-0 text-xl font-semibold tabular-nums">
              {contrib.cvSharePercent != null
                ? `${Number(contrib.cvSharePercent).toFixed(1)}%`
                : '—'}
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
      )}

      {daily.length > 1 && (
        <div>
          <p className="m-0 mb-3 text-sm text-muted">日次検索数（当月）</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} interval={2} />
              <YAxis tick={{ fontSize: 11, fill: '#666' }} />
              <Tooltip />
              <Bar dataKey="searches" fill="#111111" name="検索数" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
