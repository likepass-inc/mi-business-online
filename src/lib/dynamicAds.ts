export const DYNAMIC_AD_SOURCE = 'logicad'
export const PURCHASE_EVENT_NAME = '購入完了'

export type DynamicAdPlacement = 'retargeting' | 'valis' | 'other'

export interface MetricRow {
  sessions: number
  purchases: number
  revenue: number
}

export interface BreakdownRow extends MetricRow {
  key: string
  label: string
}

export interface ComparedBreakdownRow extends BreakdownRow {
  previous: MetricRow
}

type Ga4Row = Record<string, string | number>

const CAMPAIGN_LABELS: Record<string, string> = {
  oseibo: '歳暮',
}

export function classifyDynamicAdContent(content: string): DynamicAdPlacement {
  const value = content.trim().toLowerCase()
  if (value.startsWith('lo01') || value.includes('lo01-')) return 'retargeting'
  if (value.startsWith('lo02') || value.includes('lo02-')) return 'valis'
  return 'other'
}

export function placementLabel(placement: DynamicAdPlacement): string {
  if (placement === 'retargeting') return 'リターゲティング'
  if (placement === 'valis') return 'VALIS-拡張'
  return 'その他'
}

export function formatCampaignName(campaign: string): string {
  const raw = campaign.trim()
  if (!raw || raw === '(not set)') return '未設定'
  const label = CAMPAIGN_LABELS[raw.toLowerCase()]
  return label ? `${raw}（${label}）` : raw
}

export function conversionRate(metrics: Pick<MetricRow, 'sessions' | 'purchases'>): number {
  if (metrics.sessions <= 0) return 0
  return (metrics.purchases / metrics.sessions) * 100
}

function num(row: Ga4Row, key: string): number {
  return Number(row[key] ?? 0)
}

export function summarizeTraffic(rows: Ga4Row[]): { sessions: number; revenue: number } {
  const totals = rows.reduce(
    (acc, row) => ({
      sessions: acc.sessions + num(row, 'sessions'),
      revenue: acc.revenue + num(row, 'purchaseRevenue'),
    }),
    { sessions: 0, revenue: 0 }
  )
  return { sessions: totals.sessions, revenue: Math.round(totals.revenue) }
}

export function summarizePurchases(rows: Ga4Row[]): number {
  return rows.reduce((sum, row) => sum + num(row, 'eventCount'), 0)
}

function addMetrics(
  groups: Map<string, { label: string; sessions: number; purchases: number; revenue: number }>,
  key: string,
  label: string,
  patch: Partial<MetricRow>
) {
  const current = groups.get(key) ?? { label, sessions: 0, purchases: 0, revenue: 0 }
  current.label = label
  current.sessions += patch.sessions ?? 0
  current.purchases += patch.purchases ?? 0
  current.revenue += patch.revenue ?? 0
  groups.set(key, current)
}

function toBreakdownRows(
  groups: Map<string, { label: string; sessions: number; purchases: number; revenue: number }>
): BreakdownRow[] {
  return [...groups.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      sessions: value.sessions,
      purchases: value.purchases,
      revenue: Math.round(value.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.purchases - a.purchases || b.sessions - a.sessions || a.label.localeCompare(b.label, 'ja'))
}

export function buildCampaignBreakdown(traffic: Ga4Row[], purchases: Ga4Row[]): BreakdownRow[] {
  const groups = new Map<string, { label: string; sessions: number; purchases: number; revenue: number }>()
  for (const row of traffic) {
    const raw = String(row.sessionCampaignName ?? '')
    addMetrics(groups, raw, formatCampaignName(raw), {
      sessions: num(row, 'sessions'),
      revenue: num(row, 'purchaseRevenue'),
    })
  }
  for (const row of purchases) {
    const raw = String(row.sessionCampaignName ?? '')
    addMetrics(groups, raw, formatCampaignName(raw), {
      purchases: num(row, 'eventCount'),
    })
  }
  return toBreakdownRows(groups)
}

export function buildPlacementBreakdown(traffic: Ga4Row[], purchases: Ga4Row[]): BreakdownRow[] {
  const groups = new Map<string, { label: string; sessions: number; purchases: number; revenue: number }>()
  for (const row of traffic) {
    const placement = classifyDynamicAdContent(String(row.sessionManualAdContent ?? ''))
    addMetrics(groups, placement, placementLabel(placement), {
      sessions: num(row, 'sessions'),
      revenue: num(row, 'purchaseRevenue'),
    })
  }
  for (const row of purchases) {
    const placement = classifyDynamicAdContent(String(row.sessionManualAdContent ?? ''))
    addMetrics(groups, placement, placementLabel(placement), {
      purchases: num(row, 'eventCount'),
    })
  }
  return toBreakdownRows(groups)
}

export function compareBreakdowns(current: BreakdownRow[], previous: BreakdownRow[]): ComparedBreakdownRow[] {
  const currentByKey = new Map(current.map((row) => [row.key, row]))
  const previousByKey = new Map(previous.map((row) => [row.key, row]))
  const keys = new Set([...currentByKey.keys(), ...previousByKey.keys()])
  return [...keys]
    .map((key) => {
      const cur = currentByKey.get(key)
      const prev = previousByKey.get(key)
      return {
        key,
        label: cur?.label ?? prev?.label ?? key,
        sessions: cur?.sessions ?? 0,
        purchases: cur?.purchases ?? 0,
        revenue: cur?.revenue ?? 0,
        previous: {
          sessions: prev?.sessions ?? 0,
          purchases: prev?.purchases ?? 0,
          revenue: prev?.revenue ?? 0,
        },
      }
    })
    .sort((a, b) => b.revenue - a.revenue || b.purchases - a.purchases || b.sessions - a.sessions || a.label.localeCompare(b.label, 'ja'))
}
