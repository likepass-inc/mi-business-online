import { notFound } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import MonthlyBreadcrumbs from '@/components/monthly/MonthlyBreadcrumbs'
import MarkdownDocument from '@/components/ui/MarkdownDocument'
import PageHeader from '@/components/ui/PageHeader'
import { getMonthlySection, isValidMonthKey } from '@/lib/monthlyReports'
import { isMonthlySectionId } from '@/lib/monthlyReportSections'

interface PageProps {
  params: { month: string; section: string }
}

export default function MonthlyReportSectionPage({ params }: PageProps) {
  if (!isValidMonthKey(params.month) || !isMonthlySectionId(params.section)) notFound()
  const content = getMonthlySection(params.month, params.section)
  if (!content) notFound()

  const { meta, title, description, markdown } = content

  return (
    <AppLayout>
      <div className="grid gap-8">
        <MonthlyBreadcrumbs
          items={[
            { href: '/monthly', label: '月次レポート' },
            { href: `/monthly/${meta.monthKey}`, label: meta.label },
            { label: title },
          ]}
        />

        <PageHeader title={title} description={description} />

        <MarkdownDocument markdown={markdown} />
      </div>
    </AppLayout>
  )
}
