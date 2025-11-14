import { fetchGA4Data } from './ga4Client'
import { fetchGSCData } from './gscClient'
import type { ParsedQuery, GA4Response, GSCResponse } from './types'

export async function fetchAnalyticsData(query: ParsedQuery): Promise<{ rows: Record<string, string | number>[] }> {
  if (query.source === 'GA4') {
    const data = await fetchGA4Data({
      dateRange: query.dateRange,
      metrics: query.metrics,
      dimensions: query.dimensions,
      filters: query.filters,
    })
    return { rows: data.rows }
  } else {
    const data = await fetchGSCData({
      startDate: query.dateRange.startDate,
      endDate: query.dateRange.endDate,
      dimensions: query.dimensions || ['query', 'page'],
      rowLimit: 1000,
    })
    // GSCRowをRecord型に変換
    const rows = data.rows.map(row => ({
      query: row.query || '',
      page: row.page || '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }))
    return { rows }
  }
}

