import sharp from 'sharp'
import type { MonthlyTrendPoint } from '@/lib/buildMonthlyTrendSeries'

export type MonthlyTrendMetricId =
  | 'gsc_clicks'
  | 'gsc_impressions'
  | 'gsc_average_ctr'
  | 'gsc_average_position'
  | 'ga4_sessions'
  | 'ga4_users'
  | 'ga4_page_views'
  | 'ga4_transactions'
  | 'ga4_revenue'
  | 'ga4_conversion_rate'

export interface MonthlyTrendMetricDef {
  id: MonthlyTrendMetricId
  title: string
  group: 'gsc' | 'ga4'
  invertY?: boolean
  suffix?: string
  getValue: (point: MonthlyTrendPoint) => number
  formatValue: (value: number) => string
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatCompactCurrency(n: number): string {
  if (n >= 1_000_000_000) return `¥${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `¥${(n / 1_000).toFixed(0)}K`
  return `¥${formatNumber(Math.round(n))}`
}

export const MONTHLY_TREND_METRICS: MonthlyTrendMetricDef[] = [
  {
    id: 'gsc_clicks',
    title: 'GSC Clicks',
    group: 'gsc',
    getValue: (p) => p.gsc.clicks,
    formatValue: formatNumber,
  },
  {
    id: 'gsc_impressions',
    title: 'GSC Impressions',
    group: 'gsc',
    getValue: (p) => p.gsc.impressions,
    formatValue: formatNumber,
  },
  {
    id: 'gsc_average_ctr',
    title: 'GSC Avg CTR',
    group: 'gsc',
    suffix: '%',
    getValue: (p) => p.gsc.averageCtr,
    formatValue: (v) => `${v.toFixed(2)}%`,
  },
  {
    id: 'gsc_average_position',
    title: 'GSC Avg Position',
    group: 'gsc',
    invertY: true,
    getValue: (p) => p.gsc.averagePosition,
    formatValue: (v) => v.toFixed(2),
  },
  {
    id: 'ga4_sessions',
    title: 'GA4 Sessions',
    group: 'ga4',
    getValue: (p) => p.ga4.sessions,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_users',
    title: 'GA4 Users',
    group: 'ga4',
    getValue: (p) => p.ga4.users,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_page_views',
    title: 'GA4 Page Views',
    group: 'ga4',
    getValue: (p) => p.ga4.pageViews,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_transactions',
    title: 'GA4 Transactions',
    group: 'ga4',
    getValue: (p) => p.ga4.transactions,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_revenue',
    title: 'GA4 Revenue',
    group: 'ga4',
    suffix: 'JPY',
    getValue: (p) => p.ga4.revenue,
    formatValue: formatCompactCurrency,
  },
  {
    id: 'ga4_conversion_rate',
    title: 'GA4 CVR',
    group: 'ga4',
    suffix: '%',
    getValue: (p) => p.ga4.conversionRate,
    formatValue: (v) => `${v.toFixed(2)}%`,
  },
]

const CHART_WIDTH = 900
const CHART_HEIGHT = 420
const PADDING = { top: 48, right: 24, bottom: 56, left: 72 }

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function svgText(
  text: string,
  x: number,
  y: number,
  options: {
    fontSize: number
    fill: string
    anchor?: 'start' | 'middle' | 'end'
    fontWeight?: string
  }
): string {
  const anchor = options.anchor ?? 'start'
  const weight = options.fontWeight ? ` font-weight="${options.fontWeight}"` : ''
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-family="sans-serif" font-size="${options.fontSize}" fill="${options.fill}"${weight}>${escapeXml(text)}</text>`
}

function buildLineChartSvg(
  metric: MonthlyTrendMetricDef,
  points: MonthlyTrendPoint[],
  reportMonthKey: string
): string {
  const values = points.map((p) => metric.getValue(p))
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const range = rawMax - rawMin || 1
  const min = rawMin - range * 0.08
  const max = rawMax + range * 0.08

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom

  const coords = points.map((point, i) => {
    const value = metric.getValue(point)
    const x = PADDING.left + (i / Math.max(points.length - 1, 1)) * plotW
    const normalized =
      metric.invertY === true
        ? (value - min) / (max - min)
        : 1 - (value - min) / (max - min)
    const y = PADDING.top + normalized * plotH
    return { x, y, point, value }
  })

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')

  const xLabels = coords
    .map((c, i) => {
      if (points.length > 8 && i % 2 !== 0 && i !== points.length - 1) return ''
      const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
      return svgText(c.point.label, c.x, CHART_HEIGHT - 18, {
        fontSize: 11,
        fill: '#64748b',
        anchor,
      })
    })
    .join('')

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const value = metric.invertY ? min + (max - min) * t : max - (max - min) * t
    const y = PADDING.top + t * plotH
    return `${svgText(metric.formatValue(value), PADDING.left - 8, y + 4, {
      fontSize: 11,
      fill: '#64748b',
      anchor: 'end',
    })}
<line x1="${PADDING.left}" y1="${y.toFixed(1)}" x2="${CHART_WIDTH - PADDING.right}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>`
  })

  const dots = coords
    .map((c) => {
      const isLatest = c.point.monthKey === reportMonthKey
      const fill = isLatest ? '#2563eb' : '#3b82f6'
      const r = isLatest ? 5 : 3.5
      return `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" fill="${fill}" />`
    })
    .join('')

  const invertNote = metric.invertY
    ? svgText('* Lower is better', PADDING.left, CHART_HEIGHT - 4, {
        fontSize: 10,
        fill: '#94a3b8',
      })
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${svgText(`${metric.title} — 13-month trend`, PADDING.left, 28, {
    fontSize: 18,
    fill: '#0f172a',
    fontWeight: '600',
  })}
  ${yTicks.join('')}
  <polyline points="${polyline}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
  ${xLabels}
  ${invertNote}
</svg>`
}

export async function renderMonthlyTrendChartPng(
  metric: MonthlyTrendMetricDef,
  points: MonthlyTrendPoint[],
  reportMonthKey: string
): Promise<Buffer> {
  const svg = buildLineChartSvg(metric, points, reportMonthKey)
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function renderAllMonthlyTrendCharts(
  points: MonthlyTrendPoint[],
  reportMonthKey: string
): Promise<Array<{ metric: MonthlyTrendMetricDef; png: Buffer }>> {
  const results: Array<{ metric: MonthlyTrendMetricDef; png: Buffer }> = []
  for (const metric of MONTHLY_TREND_METRICS) {
    const png = await renderMonthlyTrendChartPng(metric, points, reportMonthKey)
    results.push({ metric, png })
  }
  return results
}
