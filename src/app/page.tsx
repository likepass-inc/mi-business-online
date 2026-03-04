'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import KpiCards from '@/components/dashboard/KpiCards'
import TrafficChart from '@/components/dashboard/TrafficChart'
import KeywordAnalysis from '@/components/dashboard/KeywordAnalysis'
import ContentPopularityAnalysis from '@/components/dashboard/ContentPopularityAnalysis'
import ConversionPath from '@/components/dashboard/ConversionPath'
import ProductChanges from '@/components/dashboard/ProductChanges'
import ChatWindow from '@/components/chat/ChatWindow'

export default function Home() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate })
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">MI Business Online Analytics</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const end = new Date().toISOString().split('T')[0]
                const start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                handleDateRangeChange(start, end)
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              直近7日
            </button>
            <button
              onClick={() => {
                const end = new Date().toISOString().split('T')[0]
                const start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                handleDateRangeChange(start, end)
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              直近30日
            </button>
            <button
              onClick={() => {
                const end = new Date().toISOString().split('T')[0]
                const start = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                handleDateRangeChange(start, end)
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              直近90日
            </button>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            期間: {dateRange.startDate} 〜 {dateRange.endDate}
          </div>
        </div>

        <div className="mb-8">
          <KpiCards dateRange={dateRange} />
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">トラフィック推移</h2>
            <TrafficChart dateRange={dateRange} />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">キーワード分析</h2>
            <KeywordAnalysis dateRange={dateRange} />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">コンテンツ人気分析</h2>
            <ContentPopularityAnalysis dateRange={dateRange} />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">コンバージョン経路</h2>
            <ConversionPath dateRange={dateRange} />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">新商品・販売終了商品</h2>
            <ProductChanges newLimit={10} newDays={7} discontinuedLimit={10} />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">AI アナリスト</h2>
            <ChatWindow />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

