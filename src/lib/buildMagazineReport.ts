import { fetchGA4Data } from '@/lib/ga4Client'
import { fetchGSCData } from '@/lib/gscClient'

export interface MagazineReportResponse {
  magazinePathPrefix: string
  gsc: {
    summary: {
      totalClicks: number
      totalImpressions: number
      averageCtr: number
      averagePosition: number
    }
    topQueries: Array<{
      query: string
      clicks: number
      impressions: number
      ctr: number
      position: number
    }>
    topPages: Array<{
      page: string
      clicks: number
      impressions: number
      ctr: number
      position: number
    }>
    allQueries: Array<{
      query: string
      clicks: number
      impressions: number
      ctr: number
      position: number
    }>
    allPages: Array<{
      page: string
      clicks: number
      impressions: number
      ctr: number
      position: number
    }>
  }
  ga4: {
    summary: {
      sessions: number
      users: number
      pageViews: number
    }
  }
}

/**
 * /magazine/ 等のパスプレフィックスで GSC・GA4 を絞り込んだレポート
 */
export async function buildMagazineReport(
  startDate: string,
  endDate: string,
  magazinePathPrefix: string
): Promise<MagazineReportResponse> {
  const pageContains = magazinePathPrefix

  const [gscAgg, gscQueryData, gscPageData, ga4Mag] = await Promise.all([
    fetchGSCData({ startDate, endDate, rowLimit: 10000, pageContains }),
    fetchGSCData({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 10000,
      pageContains,
    }),
    fetchGSCData({
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 100,
      pageContains,
    }),
    fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['sessions', 'activeUsers', 'screenPageViews'],
      filters: [
        {
          field: 'pagePath',
          operator: 'CONTAINS',
          value: magazinePathPrefix,
        },
      ],
    }),
  ])

  const totalClicks = gscAgg.rows.reduce((sum, row) => sum + row.clicks, 0)
  const totalImpressions = gscAgg.rows.reduce((sum, row) => sum + row.impressions, 0)
  const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const averagePosition =
    gscAgg.rows.length > 0
      ? gscAgg.rows.reduce((sum, row) => sum + row.position, 0) / gscAgg.rows.length
      : 0

  const magRow = ga4Mag.rows[0] || {}
  const sessions = Number(magRow.sessions || 0)
  const users = Number(magRow.activeUsers || 0)
  const pageViews = Number(magRow.screenPageViews || 0)

  return {
    magazinePathPrefix,
    gsc: {
      summary: {
        totalClicks,
        totalImpressions,
        averageCtr: Math.round(averageCtr * 100) / 100,
        averagePosition: Math.round(averagePosition * 100) / 100,
      },
      topQueries: gscQueryData.rows.slice(0, 10).map((row) => ({
        query: row.query || '',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 10000) / 100,
        position: Math.round(row.position * 100) / 100,
      })),
      allQueries: gscQueryData.rows.map((row) => ({
        query: row.query || '',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 10000) / 100,
        position: Math.round(row.position * 100) / 100,
      })),
      topPages: gscPageData.rows.slice(0, 10).map((row) => ({
        page: row.page || '',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 10000) / 100,
        position: Math.round(row.position * 100) / 100,
      })),
      allPages: gscPageData.rows.map((row) => ({
        page: row.page || '',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 10000) / 100,
        position: Math.round(row.position * 100) / 100,
      })),
    },
    ga4: {
      summary: {
        sessions,
        users,
        pageViews,
      },
    },
  }
}
