'use client'

import { useEffect, useState } from 'react'
import type { DateRange } from '@/lib/types'
import { getPreviousPeriod, getYearOverYearPeriod } from '@/lib/dateUtils'
import { cachedJsonPost } from '@/lib/dashboardFetchCache'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { Stat, StatGrid } from '@/components/ui/StatGrid'
import { tableClass, tdClass, thClass } from '@/components/ui/styles'
import {
  DYNAMIC_AD_SOURCE,
  PURCHASE_EVENT_NAME,
  buildCampaignBreakdown,
  buildPlacementBreakdown,
  compareBreakdowns,
  conversionRate,
  summarizePurchases,
  summarizeTraffic,
  type ComparedBreakdownRow,
  type MetricRow,
} from '@/lib/dynamicAds'

interface DynamicAdPurchasesProps {
  dateRange: DateRange
}

interface PeriodSnapshot {
  totals: MetricRow
  campaigns: ReturnType<typeof buildCampaignBreakdown>
  placements: ReturnType<typeof buildPlacementBreakdown>
}

type ComparisonMode = 'previous-period' | 'year-over-year'
type Ga4Row = Record<string, string | number>

const sourceFilter = { field: 'sessionSource', operator: 'EXACT' as const, value: DYNAMIC_AD_SOURCE }
const purchaseFilter = { field: 'eventName', operator: 'EXACT' as const, value: PURCHASE_EVENT_NAME }

function formatCount(value: number) {
  return Math.round(value).toLocaleString()
}

function formatYen(value: number) {
  return `¥${Math.round(value).toLocaleString()}`
}

function formatRate(value: number) {
  return `${value.toFixed(2)}%`
}

function ComparisonDisplay({
  current,
  previous,
  format,
}: {
  current: number
  previous: number
  format: (value: number) => string
}) {
  if (previous === 0) {
    return <p className="m-0 text-xs text-muted">-</p>
  }
  const diff = current - previous
  const percent = (diff / previous) * 100
  const colorClass = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-danger' : 'text-muted'
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : ''
  return (
    <p className={`m-0 text-xs ${colorClass}`}>
      {sign}{format(Math.abs(diff))} ({sign}{percent.toFixed(2)}%)
    </p>
  )
}

function ComparisonCell({
  current,
  previous,
  format,
}: {
  current: number
  previous: number
  format: (value: number) => string
}) {
  return (
    <div>
      <div>{format(current)}</div>
      <ComparisonDisplay current={current} previous={previous} format={format} />
    </div>
  )
}

function BreakdownTable({
  title,
  nameHeader,
  rows,
}: {
  title: string
  nameHeader: string
  rows: ComparedBreakdownRow[]
}) {
  return (
    <div className="grid gap-3">
      <h3 className="m-0 text-base font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-muted">この期間の内訳はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>{nameHeader}</th>
                <th className={thClass}>セッション</th>
                <th className={thClass}>購入件数</th>
                <th className={thClass}>売上</th>
                <th className={thClass}>CVR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className={tdClass}>{row.label}</td>
                  <td className={tdClass}>
                    <ComparisonCell current={row.sessions} previous={row.previous.sessions} format={formatCount} />
                  </td>
                  <td className={tdClass}>
                    <ComparisonCell current={row.purchases} previous={row.previous.purchases} format={formatCount} />
                  </td>
                  <td className={tdClass}>
                    <ComparisonCell current={row.revenue} previous={row.previous.revenue} format={formatYen} />
                  </td>
                  <td className={tdClass}>
                    <ComparisonCell
                      current={conversionRate(row)}
                      previous={conversionRate(row.previous)}
                      format={formatRate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

async function fetchPeriod(dateRange: DateRange): Promise<PeriodSnapshot> {
  const [summary, purchases, trafficBreakdown, purchaseBreakdown] = await Promise.all([
    cachedJsonPost('/api/ga4', {
      dateRange,
      metrics: ['sessions', 'purchaseRevenue'],
      filters: [sourceFilter],
    }),
    cachedJsonPost('/api/ga4', {
      dateRange,
      metrics: ['eventCount'],
      dimensions: ['eventName'],
      filters: [sourceFilter, purchaseFilter],
    }),
    cachedJsonPost('/api/ga4', {
      dateRange,
      metrics: ['sessions', 'purchaseRevenue'],
      dimensions: ['sessionCampaignName', 'sessionManualAdContent'],
      filters: [sourceFilter],
    }),
    cachedJsonPost('/api/ga4', {
      dateRange,
      metrics: ['eventCount'],
      dimensions: ['sessionCampaignName', 'sessionManualAdContent', 'eventName'],
      filters: [sourceFilter, purchaseFilter],
    }),
  ])

  const trafficRows = (summary.rows ?? []) as Ga4Row[]
  const purchaseRows = (purchases.rows ?? []) as Ga4Row[]
  const trafficBreakdownRows = (trafficBreakdown.rows ?? []) as Ga4Row[]
  const purchaseBreakdownRows = (purchaseBreakdown.rows ?? []) as Ga4Row[]
  const traffic = summarizeTraffic(trafficRows)

  return {
    totals: {
      sessions: traffic.sessions,
      purchases: summarizePurchases(purchaseRows),
      revenue: traffic.revenue,
    },
    campaigns: buildCampaignBreakdown(trafficBreakdownRows, purchaseBreakdownRows),
    placements: buildPlacementBreakdown(trafficBreakdownRows, purchaseBreakdownRows),
  }
}

export default function DynamicAdPurchases({ dateRange }: DynamicAdPurchasesProps) {
  const [current, setCurrent] = useState<PeriodSnapshot | null>(null)
  const [previous, setPrevious] = useState<PeriodSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('year-over-year')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const comparisonRange = comparisonMode === 'year-over-year'
          ? getYearOverYearPeriod(dateRange.startDate, dateRange.endDate)
          : getPreviousPeriod(dateRange.startDate, dateRange.endDate)

        const [currentPeriod, previousPeriod] = await Promise.all([
          fetchPeriod(dateRange),
          fetchPeriod(comparisonRange),
        ])
        if (cancelled) return
        setCurrent(currentPeriod)
        setPrevious(previousPeriod)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dateRange, comparisonMode])

  if (loading) {
    return (
      <StatGrid>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="grid gap-2 py-5 animate-pulse">
            <div className="h-3 bg-line w-1/2"></div>
            <div className="h-7 bg-line w-3/4"></div>
          </div>
        ))}
      </StatGrid>
    )
  }

  if (error) {
    return <p className="m-0 text-danger text-sm">エラー: {error}</p>
  }

  if (!current || !previous) {
    return null
  }

  const currentRate = conversionRate(current.totals)
  const previousRate = conversionRate(previous.totals)

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <div className="flex justify-end">
          <SegmentedControl
            ariaLabel="ダイナミック広告の比較対象"
            value={comparisonMode}
            onChange={setComparisonMode}
            options={[
              { value: 'year-over-year', label: '前年同時期対比' },
              { value: 'previous-period', label: '前期間対比' },
            ]}
          />
        </div>
        <StatGrid>
          <Stat
            label="セッション"
            value={formatCount(current.totals.sessions)}
            meta={<ComparisonDisplay current={current.totals.sessions} previous={previous.totals.sessions} format={formatCount} />}
          />
          <Stat
            label="購入件数"
            value={formatCount(current.totals.purchases)}
            meta={<ComparisonDisplay current={current.totals.purchases} previous={previous.totals.purchases} format={formatCount} />}
          />
          <Stat
            label="売上"
            value={formatYen(current.totals.revenue)}
            meta={<ComparisonDisplay current={current.totals.revenue} previous={previous.totals.revenue} format={formatYen} />}
          />
          <Stat
            label="CVR"
            value={formatRate(currentRate)}
            meta={<ComparisonDisplay current={currentRate} previous={previousRate} format={formatRate} />}
          />
        </StatGrid>
      </div>

      <BreakdownTable
        title="キャンペーン"
        nameHeader="キャンペーン"
        rows={compareBreakdowns(current.campaigns, previous.campaigns)}
      />
      <BreakdownTable
        title="配信種別"
        nameHeader="配信種別"
        rows={compareBreakdowns(current.placements, previous.placements)}
      />
    </div>
  )
}
