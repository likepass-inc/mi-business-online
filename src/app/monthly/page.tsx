import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { linkClass, mutedClass } from '@/components/ui/styles'
import { listMonthlyReports } from '@/lib/monthlyReports'

export default function MonthlyReportIndexPage() {
  const reports = listMonthlyReports()

  return (
    <AppLayout>
      <div className="grid gap-8">
        <PageHeader
          title="月次レポート"
          description="サイト全体とマガジンの集客・売上の月次レポートです。ログインした社内向けです。"
        />

        {reports.length === 0 ? (
          <p className={`m-0 ${mutedClass}`}>
            まだレポートがありません。CLI（
            <code className="text-ink">npx tsx scripts/generate-monthly-site-report.ts</code>
            ）で生成してください。
          </p>
        ) : (
          <ul className="m-0 grid gap-0 list-none border-t border-line p-0">
            {reports.map((report) => (
              <li key={report.monthKey} className="border-b border-line">
                <Link
                  href={`/monthly/${report.monthKey}`}
                  className={`block py-4 text-[15px] ${linkClass} no-underline hover:underline`}
                >
                  {report.listTitle}
                  <span className={`ml-3 font-normal ${mutedClass}`}>
                    {report.periodStart}〜{report.periodEnd}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
