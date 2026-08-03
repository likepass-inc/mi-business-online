import { fetchGA4Data } from '@/lib/ga4Client'
import { fetchGSCData } from '@/lib/gscClient'

export interface SiteKpiSummary {
  gsc: {
    totalClicks: number
    totalImpressions: number
    averageCtr: number
    averagePosition: number
  }
  ga4: {
    sessions: number
    users: number
    pageViews: number
    transactions: number
    revenue: number
    conversionRate: number
  }
}

export interface SiteReportResponse {
  period: {
    startDate: string
    endDate: string
  }
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
    allQueries: Array<{
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
    /** GSC page 次元の取得行（最大 rowLimit 件、YoY 比較用） */
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
      transactions: number
      revenue: number
      conversionRate: number
    }
    byChannel: Array<{
      channel: string
      sessions: number
      users: number
      transactions: number
      revenue: number
    }>
    byDevice: Array<{
      device: string
      sessions: number
      users: number
      transactions: number
      revenue: number
    }>
  }
}

function summarizeGscRows(
  rows: Array<{ clicks: number; impressions: number; position: number }>
): SiteKpiSummary['gsc'] {
  const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0)
  const totalImpressions = rows.reduce((sum, row) => sum + row.impressions, 0)
  const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const averagePosition =
    rows.length > 0 ? rows.reduce((sum, row) => sum + row.position, 0) / rows.length : 0
  return {
    totalClicks,
    totalImpressions,
    averageCtr: Math.round(averageCtr * 100) / 100,
    averagePosition: Math.round(averagePosition * 100) / 100,
  }
}

function summarizeGa4FromFetches(
  ga4Summary: Awaited<ReturnType<typeof fetchGA4Data>>,
  ga4PurchaseRevenue: Awaited<ReturnType<typeof fetchGA4Data>>,
  ga4ItemRevenue: Awaited<ReturnType<typeof fetchGA4Data>>,
  ga4AllEvents: Awaited<ReturnType<typeof fetchGA4Data>>
): SiteKpiSummary['ga4'] {
  const totalItemRevenue = ga4ItemRevenue.rows.reduce(
    (sum: number, row: Record<string, string | number>) => sum + Number(row.itemRevenue || 0),
    0
  )

  const purchaseRow = ga4AllEvents.rows.find(
    (row: Record<string, string | number>) =>
      row.eventName === 'purchase' || row.eventName === '支払完了' || row.eventName === '購入完了'
  )
  const purchaseCompletedRow = ga4AllEvents.rows.find(
    (row: Record<string, string | number>) => row.eventName === '購入完了'
  )

  const summaryRow = ga4Summary.rows[0] || {}
  const sessions = Number(summaryRow.sessions || 0)
  const users = Number(summaryRow.activeUsers || 0)
  const pageViews = Number(summaryRow.screenPageViews || 0)
  const purchaseRevenueValue = ga4PurchaseRevenue.rows[0]?.purchaseRevenue || 0

  const purchaseCompletedRevenue = purchaseCompletedRow
    ? Number(purchaseCompletedRow.totalRevenue || 0)
    : 0
  const paymentCompletedRevenue =
    purchaseRow && purchaseRow.eventName === '支払完了'
      ? Number(purchaseRow.totalRevenue || 0)
      : 0

  const revenue = Number(
    purchaseRevenueValue ||
      purchaseCompletedRevenue + paymentCompletedRevenue ||
      totalItemRevenue ||
      summaryRow.totalRevenue ||
      0
  )

  const transactions = purchaseCompletedRow ? Number(purchaseCompletedRow.eventCount || 0) : 0
  const conversionRate = sessions > 0 ? (transactions / sessions) * 100 : 0

  return {
    sessions,
    users,
    pageViews,
    transactions,
    revenue: Math.round(revenue),
    conversionRate: Math.round(conversionRate * 100) / 100,
  }
}

/** サイト全体 KPI サマリのみ（トレンド用・軽量） */
export async function fetchSiteKpiSummary(
  startDate: string,
  endDate: string
): Promise<SiteKpiSummary> {
  const [gscData, ga4Summary, ga4PurchaseRevenue, ga4ItemRevenue, ga4AllEvents] =
    await Promise.all([
      fetchGSCData({ startDate, endDate, rowLimit: 10000 }),
      fetchGA4Data({
        dateRange: { startDate, endDate },
        metrics: ['sessions', 'activeUsers', 'screenPageViews', 'totalRevenue'],
      }),
      fetchGA4Data({
        dateRange: { startDate, endDate },
        metrics: ['purchaseRevenue'],
      }),
      fetchGA4Data({
        dateRange: { startDate, endDate },
        metrics: ['itemRevenue', 'itemPurchaseQuantity'],
        dimensions: ['itemName'],
      }),
      fetchGA4Data({
        dateRange: { startDate, endDate },
        metrics: ['eventCount', 'totalRevenue'],
        dimensions: ['eventName'],
      }),
    ])

  return {
    gsc: summarizeGscRows(gscData.rows),
    ga4: summarizeGa4FromFetches(ga4Summary, ga4PurchaseRevenue, ga4ItemRevenue, ga4AllEvents),
  }
}

/**
 * 単一期間のサイト全体レポート（既存 /api/report と同一ロジック）
 */
export async function buildSiteReport(
  startDate: string,
  endDate: string
): Promise<SiteReportResponse> {
  const [gscData, gscQueryData, gscPageData] = await Promise.all([
    fetchGSCData({ startDate, endDate, rowLimit: 10000 }),
    fetchGSCData({ startDate, endDate, dimensions: ['query'], rowLimit: 10000 }),
    fetchGSCData({ startDate, endDate, dimensions: ['page'], rowLimit: 100 }),
  ])

  const gscSummary = summarizeGscRows(gscData.rows)

  const [
    ga4Summary,
    ga4PurchaseRevenue,
    ga4ItemRevenue,
    ga4AllEvents,
    ga4ByChannel,
    ga4ByChannelTransactions,
    ga4ByDevice,
    ga4ByDeviceTransactions,
  ] = await Promise.all([
    fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['sessions', 'activeUsers', 'screenPageViews', 'totalRevenue'],
    }),
    fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['purchaseRevenue'],
    }),
    fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['itemRevenue', 'itemPurchaseQuantity'],
      dimensions: ['itemName'],
    }),
    fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['eventCount', 'totalRevenue'],
      dimensions: ['eventName'],
    }),
    fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['sessions', 'activeUsers', 'purchaseRevenue', 'totalRevenue'],
      dimensions: ['sessionDefaultChannelGroup'],
    }),
    fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['eventCount'],
      dimensions: ['sessionDefaultChannelGroup', 'eventName'],
      filters: [{ field: 'eventName', operator: 'EXACT', value: '購入完了' }],
    }),
    fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['sessions', 'activeUsers', 'purchaseRevenue', 'totalRevenue'],
      dimensions: ['deviceCategory'],
    }),
    fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['eventCount'],
      dimensions: ['deviceCategory', 'eventName'],
      filters: [{ field: 'eventName', operator: 'EXACT', value: '購入完了' }],
    }),
  ])

  const ga4SummaryData = summarizeGa4FromFetches(
    ga4Summary,
    ga4PurchaseRevenue,
    ga4ItemRevenue,
    ga4AllEvents
  )

  return {
    period: {
      startDate,
      endDate,
    },
    gsc: {
      summary: gscSummary,
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
      summary: ga4SummaryData,
      byChannel: ga4ByChannel.rows
        .map((row) => {
          const channel = (row.sessionDefaultChannelGroup as string) || '不明'
          const channelTransactionRow = ga4ByChannelTransactions.rows.find(
            (r: Record<string, string | number>) =>
              r.sessionDefaultChannelGroup === channel && r.eventName === '購入完了'
          )
          const channelTransactions = channelTransactionRow
            ? Number(channelTransactionRow.eventCount || 0)
            : 0

          return {
            channel,
            sessions: Number(row.sessions || 0),
            users: Number(row.activeUsers || 0),
            transactions: channelTransactions,
            revenue: Math.round(Number(row.purchaseRevenue || row.totalRevenue || 0)),
          }
        })
        .sort((a, b) => b.sessions - a.sessions),
      byDevice: ga4ByDevice.rows
        .map((row) => {
          const device = (row.deviceCategory as string) || '不明'
          const deviceTransactionRow = ga4ByDeviceTransactions.rows.find(
            (r: Record<string, string | number>) =>
              r.deviceCategory === device && r.eventName === '購入完了'
          )
          const deviceTransactions = deviceTransactionRow
            ? Number(deviceTransactionRow.eventCount || 0)
            : 0

          return {
            device,
            sessions: Number(row.sessions || 0),
            users: Number(row.activeUsers || 0),
            transactions: deviceTransactions,
            revenue: Math.round(Number(row.purchaseRevenue || row.totalRevenue || 0)),
          }
        })
        .sort((a, b) => b.sessions - a.sessions),
    },
  }
}
