import { readFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import type { MonthlyTrendPoint } from '@/lib/buildMonthlyTrendSeries'

const CHART_FONT_FAMILY = 'Noto Sans JP'
let chartFontBase64: string | null = null

function getChartFontBase64(): string {
  if (chartFontBase64 === null) {
    const packageJsonPath = require.resolve('@fontsource/noto-sans-jp/package.json')
    const fontPath = join(packageJsonPath, '../files/noto-sans-jp-japanese-400-normal.woff')
    chartFontBase64 = readFileSync(fontPath).toString('base64')
  }
  return chartFontBase64
}

function chartFontDefs(): string {
  const base64 = getChartFontBase64()
  return `<defs>
  <style>
    @font-face {
      font-family: '${CHART_FONT_FAMILY}';
      src: url('data:font/woff;base64,${base64}') format('woff');
      font-weight: 400;
      font-style: normal;
    }
  </style>
</defs>`
}

function textAttrs(extra = ''): string {
  return `font-family="${CHART_FONT_FAMILY}" ${extra}`.trim()
}

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
  return n.toLocaleString('ja-JP')
}

function formatCompact(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}万`
  return formatNumber(Math.round(n))
}

export const MONTHLY_TREND_METRICS: MonthlyTrendMetricDef[] = [
  {
    id: 'gsc_clicks',
    title: 'GSC クリック',
    group: 'gsc',
    getValue: (p) => p.gsc.clicks,
    formatValue: formatNumber,
  },
  {
    id: 'gsc_impressions',
    title: 'GSC インプレッション',
    group: 'gsc',
    getValue: (p) => p.gsc.impressions,
    formatValue: formatNumber,
  },
  {
    id: 'gsc_average_ctr',
    title: 'GSC 平均CTR',
    group: 'gsc',
    suffix: '%',
    getValue: (p) => p.gsc.averageCtr,
    formatValue: (v) => `${v.toFixed(2)}%`,
  },
  {
    id: 'gsc_average_position',
    title: 'GSC 平均掲載順位',
    group: 'gsc',
    invertY: true,
    getValue: (p) => p.gsc.averagePosition,
    formatValue: (v) => v.toFixed(2),
  },
  {
    id: 'ga4_sessions',
    title: 'GA4 セッション',
    group: 'ga4',
    getValue: (p) => p.ga4.sessions,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_users',
    title: 'GA4 ユーザー',
    group: 'ga4',
    getValue: (p) => p.ga4.users,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_page_views',
    title: 'GA4 PV',
    group: 'ga4',
    getValue: (p) => p.ga4.pageViews,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_transactions',
    title: 'GA4 購入完了',
    group: 'ga4',
    getValue: (p) => p.ga4.transactions,
    formatValue: formatNumber,
  },
  {
    id: 'ga4_revenue',
    title: 'GA4 売上',
    group: 'ga4',
    suffix: '円',
    getValue: (p) => p.ga4.revenue,
    formatValue: (v) => `¥${formatCompact(v)}`,
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
      return `<text x="${c.x.toFixed(1)}" y="${CHART_HEIGHT - 18}" text-anchor="${anchor}" ${textAttrs('font-size="11" fill="#64748b"')}>${escapeXml(c.point.label)}</text>`
    })
    .join('')

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const value = metric.invertY ? min + (max - min) * t : max - (max - min) * t
    const y = PADDING.top + t * plotH
    return `<text x="${PADDING.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" ${textAttrs('font-size="11" fill="#64748b"')}>${escapeXml(metric.formatValue(value))}</text>
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
    ? `<text x="${PADDING.left}" y="${CHART_HEIGHT - 4}" ${textAttrs('font-size="10" fill="#94a3b8"')}>※数値が小さいほど上位</text>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}">
  ${chartFontDefs()}
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${PADDING.left}" y="28" ${textAttrs('font-size="18" font-weight="600" fill="#0f172a"')}>${escapeXml(metric.title)} — 13ヶ月推移</text>
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
