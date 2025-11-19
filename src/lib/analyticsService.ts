import { fetchGA4Data } from './ga4Client'
import { fetchGSCData } from './gscClient'
import type { ParsedQuery, GA4Response, GSCResponse } from './types'

// リトライロジック（指数バックオフ）
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`Analytics data fetch failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded')
}

export async function fetchAnalyticsData(query: ParsedQuery): Promise<{ rows: Record<string, string | number>[] }> {
  console.log(`[AnalyticsService] Fetching ${query.source} data:`, {
    dateRange: query.dateRange,
    metrics: query.metrics,
    dimensions: query.dimensions,
  })

  try {
    let data: { rows: any[] }
    
  if (query.source === 'GA4') {
      data = await retryWithBackoff(async () => {
        const result = await fetchGA4Data({
      dateRange: query.dateRange,
      metrics: query.metrics,
      dimensions: query.dimensions,
      filters: query.filters,
    })
        console.log(`[AnalyticsService] GA4 data fetched: ${result.rows.length} rows`)
        return result
      })
  } else {
      data = await retryWithBackoff(async () => {
        const result = await fetchGSCData({
      startDate: query.dateRange.startDate,
      endDate: query.dateRange.endDate,
      dimensions: query.dimensions || ['query', 'page'],
      rowLimit: 1000,
    })
        console.log(`[AnalyticsService] GSC data fetched: ${result.rows.length} rows`)
        return result
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
      data = { rows }
    }

    if (!data || !data.rows || data.rows.length === 0) {
      console.warn(`[AnalyticsService] No data returned for ${query.source}`)
      return { rows: [] }
    }

    console.log(`[AnalyticsService] Successfully fetched ${data.rows.length} rows from ${query.source}`)
    return { rows: data.rows }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[AnalyticsService] Failed to fetch ${query.source} data:`, errorMessage)
    console.error(`[AnalyticsService] Error stack:`, error instanceof Error ? error.stack : undefined)
    
    // エラーが発生した場合でも空のデータを返す（分析は続行）
    return { rows: [] }
  }
}

