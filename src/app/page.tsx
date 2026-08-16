'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import KpiCards from '@/components/dashboard/KpiCards'
import TrafficChart from '@/components/dashboard/TrafficChart'
import KeywordAnalysis from '@/components/dashboard/KeywordAnalysis'
import ContentPopularityAnalysis from '@/components/dashboard/ContentPopularityAnalysis'
// import ConversionPath from '@/components/dashboard/ConversionPath'
// import ProductChanges from '@/components/dashboard/ProductChanges'
// import ChatWindow from '@/components/chat/ChatWindow'
import PageHeader from '@/components/ui/PageHeader'
import SectionHeader from '@/components/ui/SectionHeader'
import SegmentedControl from '@/components/ui/SegmentedControl'

type PeriodKey = '7' | '30' | '90'

function periodToRange(key: PeriodKey) {
  const days = Number(key)
  const end = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return { startDate: start, endDate: end }
}

export default function Home() {
  const [period, setPeriod] = useState<PeriodKey>('30')
  const [dateRange, setDateRange] = useState(() => periodToRange('30'))

  const handlePeriodChange = (key: PeriodKey) => {
    setPeriod(key)
    setDateRange(periodToRange(key))
  }

  return (
    <AppLayout>
      <div className="grid gap-10">
        <PageHeader
          title="ダッシュボード"
          description="GA4 と Search Console の主要指標です。"
        >
          <SegmentedControl
            ariaLabel="集計期間"
            value={period}
            onChange={handlePeriodChange}
            options={[
              { value: '7', label: '直近7日' },
              { value: '30', label: '直近30日' },
              { value: '90', label: '直近90日' },
            ]}
          />
          <p className="m-0 text-sm text-muted">
            期間: {dateRange.startDate} 〜 {dateRange.endDate}
          </p>
        </PageHeader>

        <KpiCards dateRange={dateRange} />

        <section className="grid gap-5">
          <SectionHeader
            title="トラフィック推移"
            description="セッションとトランザクションの日次推移です。"
          />
          <TrafficChart dateRange={dateRange} />
        </section>

        <section className="grid gap-5">
          <SectionHeader
            title="キーワード分析"
            description="Search Console のクエリとランディングページです。"
          />
          <KeywordAnalysis dateRange={dateRange} />
        </section>

        <section className="grid gap-5">
          <SectionHeader
            title="コンテンツ人気分析"
            description="記事・商品・一覧ページのクリックと表示回数です。"
          />
          <ContentPopularityAnalysis dateRange={dateRange} />
        </section>

        {/*
        <section className="grid gap-5">
          <SectionHeader
            title="コンバージョン経路"
            description="流入から購入までのステップと離脱です。"
          />
          <ConversionPath dateRange={dateRange} />
        </section>

        <section className="grid gap-5">
          <SectionHeader
            title="新商品・販売終了商品"
            description="直近の登録商品と、販売終了として検出した商品です。"
          />
          <ProductChanges newLimit={10} newDays={30} discontinuedLimit={10} />
        </section>

        <section className="grid gap-5">
          <SectionHeader
            title="AI アナリスト"
            description="期間中の数値について質問できます。"
          />
          <ChatWindow />
        </section>
        */}
      </div>
    </AppLayout>
  )
}
