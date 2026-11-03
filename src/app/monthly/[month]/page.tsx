import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import MonthlyBreadcrumbs from '@/components/monthly/MonthlyBreadcrumbs'
import PageHeader from '@/components/ui/PageHeader'
import { mutedClass } from '@/components/ui/styles'
import { getMonthlyReport, isValidMonthKey } from '@/lib/monthlyReports'

interface PageProps {
  params: { month: string }
}

export default function MonthlyReportHubPage({ params }: PageProps) {
  if (!isValidMonthKey(params.month)) notFound()
  const report = getMonthlyReport(params.month)
  if (!report) notFound()

  const { meta, sections } = report
  const sources = meta.sources?.join('、') || 'Google Search Console、GA4'

  return (
    <AppLayout>
      <div className="grid gap-8">
        <MonthlyBreadcrumbs
          items={[
            { href: '/monthly', label: '月次レポート' },
            { label: meta.label },
          ]}
        />

        <PageHeader
          title={`${meta.label} 月次レポート`}
          description={`分析期間 ${meta.periodStart}〜${meta.periodEnd}。前年同月比グラフ付き。データソースは ${sources} です。`}
        />

        <nav aria-label="この月のレポート" className="grid gap-3">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/monthly/${meta.monthKey}/${section.id}`}
              className="block border border-line bg-white px-5 py-4 no-underline transition-colors hover:border-accent"
            >
              <strong className="block text-[16px] font-semibold text-ink">{section.title}</strong>
              <span className={`mt-1 block text-sm ${mutedClass}`}>{section.description}</span>
            </Link>
          ))}
        </nav>
      </div>
    </AppLayout>
  )
}
