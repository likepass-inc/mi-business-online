'use client'

import type { MonthlyChartsPayload } from '@/lib/monthlyChartsTypes'
import type { MonthlySectionId } from '@/lib/monthlyReportSections'
import MonthlyAiSearchSummary from '@/components/monthly/MonthlyAiSearchSummary'
import MonthlyFunnelChart from '@/components/monthly/MonthlyFunnelChart'
import MonthlyTrendLines from '@/components/monthly/MonthlyTrendLines'
import MonthlyYoyBars from '@/components/monthly/MonthlyYoyBars'

export default function MonthlySectionCharts({
  sectionId,
  charts,
}: {
  sectionId: MonthlySectionId
  charts: MonthlyChartsPayload | null
}) {
  if (!charts) return null

  if (sectionId === 'summary' && charts.yoyKpis?.length) {
    return (
      <MonthlyYoyBars
        monthKey={charts.monthKey}
        yoyMonthKey={charts.yoyMonthKey}
        kpis={charts.yoyKpis}
      />
    )
  }

  if (sectionId === 'trends' && charts.trends?.length) {
    return (
      <MonthlyTrendLines trends={charts.trends} highlightMonthKey={charts.monthKey} />
    )
  }

  if (sectionId === 'funnel' && charts.funnel) {
    return (
      <MonthlyFunnelChart
        monthKey={charts.monthKey}
        yoyMonthKey={charts.yoyMonthKey}
        current={charts.funnel.current}
        yearAgo={charts.funnel.yearAgo}
      />
    )
  }

  if (sectionId === 'ai-search' && charts.aiSearch) {
    return (
      <MonthlyAiSearchSummary
        monthKey={charts.monthKey}
        yoyMonthKey={charts.yoyMonthKey}
        current={charts.aiSearch.current}
        yearAgo={charts.aiSearch.yearAgo}
      />
    )
  }

  return null
}
