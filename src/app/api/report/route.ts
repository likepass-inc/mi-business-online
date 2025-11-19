import { NextRequest, NextResponse } from 'next/server'
import { fetchGA4Data } from '@/lib/ga4Client'
import { fetchGSCData } from '@/lib/gscClient'

interface ReportResponse {
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
    topPages: Array<{
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { startDate, endDate } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    // GSCデータの取得
    const gscData = await fetchGSCData({
      startDate,
      endDate,
      rowLimit: 10000,
    })

    // クエリ別データの取得
    const gscQueryData = await fetchGSCData({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 100,
    })

    // ページ別データの取得
    const gscPageData = await fetchGSCData({
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 100,
    })

    // GSCサマリー計算
    const totalClicks = gscData.rows.reduce((sum, row) => sum + row.clicks, 0)
    const totalImpressions = gscData.rows.reduce((sum, row) => sum + row.impressions, 0)
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const averagePosition =
      gscData.rows.length > 0
        ? gscData.rows.reduce((sum, row) => sum + row.position, 0) / gscData.rows.length
        : 0

    // GA4サマリーデータの取得
    const ga4Summary = await fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['sessions', 'activeUsers', 'screenPageViews', 'totalRevenue'],
    })
    
    // purchaseRevenueを個別に取得
    const ga4PurchaseRevenue = await fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['purchaseRevenue'],
    })
    
    // itemRevenueを取得（itemNameディメンションと一緒に）
    const ga4ItemRevenue = await fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['itemRevenue', 'itemPurchaseQuantity'],
      dimensions: ['itemName'],
    })
    
    // アイテム収益の合計を計算
    const totalItemRevenue = ga4ItemRevenue.rows.reduce(
      (sum: number, row: any) => sum + Number(row.itemRevenue || 0),
      0
    )

    // GA4購入イベント数の取得
    // まず、すべてのイベントを取得してpurchaseまたは支払完了イベントを探す
    const ga4AllEvents = await fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['eventCount', 'totalRevenue'],
      dimensions: ['eventName'],
    })
    
    // purchase、支払完了、購入完了イベントを探す
    const purchaseRow = ga4AllEvents.rows.find(
      (row: any) => row.eventName === 'purchase' || row.eventName === '支払完了' || row.eventName === '購入完了'
    )
    
    // 購入完了イベントも取得
    const purchaseCompletedRow = ga4AllEvents.rows.find(
      (row: any) => row.eventName === '購入完了'
    )

    // GA4チャネル別データの取得
    const ga4ByChannel = await fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['sessions', 'activeUsers', 'purchaseRevenue', 'totalRevenue'],
      dimensions: ['sessionDefaultChannelGroup'],
    })

    // GA4チャネル別トランザクション数の取得
    const ga4ByChannelTransactions = await fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['eventCount'],
      dimensions: ['sessionDefaultChannelGroup', 'eventName'],
      filters: [
        {
          field: 'eventName',
          operator: 'EXACT',
          value: '購入完了',
        },
      ],
    })

    // GA4デバイス別データの取得
    const ga4ByDevice = await fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['sessions', 'activeUsers', 'purchaseRevenue', 'totalRevenue'],
      dimensions: ['deviceCategory'],
    })

    // GA4デバイス別トランザクション数の取得
    const ga4ByDeviceTransactions = await fetchGA4Data({
      dateRange: { startDate, endDate },
      metrics: ['eventCount'],
      dimensions: ['deviceCategory', 'eventName'],
      filters: [
        {
          field: 'eventName',
          operator: 'EXACT',
          value: '購入完了',
        },
      ],
    })

    // GA4サマリー計算
    const summaryRow = ga4Summary.rows[0] || {}
    const sessions = Number(summaryRow.sessions || 0)
    const users = Number(summaryRow.activeUsers || 0)
    const pageViews = Number(summaryRow.screenPageViews || 0)
    // 購入イベント（purchaseまたは支払完了）の収益とイベント数を取得
    // purchaseRevenueを優先的に使用（GA4の管理画面の「購入による収益」に対応）
    const purchaseRevenueValue = ga4PurchaseRevenue.rows[0]?.purchaseRevenue || 0
    
    // 購入完了と支払完了イベントの収益を合計
    const purchaseCompletedRevenue = purchaseCompletedRow
      ? Number(purchaseCompletedRow.totalRevenue || 0)
      : 0
    const paymentCompletedRevenue = purchaseRow && purchaseRow.eventName === '支払完了'
      ? Number(purchaseRow.totalRevenue || 0)
      : 0
    
    // purchaseRevenueを優先、なければ購入イベントのtotalRevenueの合計を使用
    const revenue = Number(
      purchaseRevenueValue ||
      (purchaseCompletedRevenue + paymentCompletedRevenue) ||
      totalItemRevenue ||
      summaryRow.totalRevenue ||
      0
    )
    
    // 購入イベント数をトランザクション数として使用
    // 購入完了イベントのみをトランザクションとして使用
    const transactions = purchaseCompletedRow
      ? Number(purchaseCompletedRow.eventCount || 0)
      : 0
    const conversionRate = sessions > 0 ? (transactions / sessions) * 100 : 0

    // レスポンスの構築
    const report: ReportResponse = {
      period: {
        startDate,
        endDate,
      },
      gsc: {
        summary: {
          totalClicks,
          totalImpressions,
          averageCtr: Math.round(averageCtr * 100) / 100,
          averagePosition: Math.round(averagePosition * 100) / 100,
        },
        topQueries: gscQueryData.rows
          .slice(0, 10)
          .map((row) => ({
            query: row.query || '',
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: Math.round(row.ctr * 10000) / 100,
            position: Math.round(row.position * 100) / 100,
          })),
        topPages: gscPageData.rows
          .slice(0, 10)
          .map((row) => ({
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
          transactions,
          revenue: Math.round(revenue),
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
        byChannel: ga4ByChannel.rows
          .map((row) => {
            const channel = (row.sessionDefaultChannelGroup as string) || '不明'
            // チャネル別のトランザクション数を取得
            const channelTransactionRow = ga4ByChannelTransactions.rows.find(
              (r: any) => r.sessionDefaultChannelGroup === channel && r.eventName === '購入完了'
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
            // デバイス別のトランザクション数を取得
            const deviceTransactionRow = ga4ByDeviceTransactions.rows.find(
              (r: any) => r.deviceCategory === device && r.eventName === '購入完了'
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

    return NextResponse.json(report)
  } catch (e) {
    console.error('Report API error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Report generation failed' },
      { status: 500 }
    )
  }
}

