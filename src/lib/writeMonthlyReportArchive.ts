import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import {
  buildMonthlyReportMeta,
  splitMonthlyReportMarkdown,
  type MonthlyReportMeta,
} from '@/lib/monthlyReportSections'

export function writeMonthlyReportArchive(options: {
  monthKey: string
  markdown: string
  periodStart: string
  periodEnd: string
  yoyPeriodStart?: string
  yoyPeriodEnd?: string
  generatedAt?: string
  contentRoot?: string
}): { contentDir: string; meta: MonthlyReportMeta; written: string[] } {
  const contentRoot = options.contentRoot ?? join(process.cwd(), 'content', 'monthly')
  const contentDir = join(contentRoot, options.monthKey)
  mkdirSync(contentDir, { recursive: true })

  const meta = buildMonthlyReportMeta({
    monthKey: options.monthKey,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    yoyPeriodStart: options.yoyPeriodStart,
    yoyPeriodEnd: options.yoyPeriodEnd,
    generatedAt: options.generatedAt,
  })

  writeFileSync(join(contentDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf-8')

  const sections = splitMonthlyReportMarkdown(options.markdown)
  const written: string[] = ['meta.json']
  for (const [id, body] of Object.entries(sections)) {
    if (!body) continue
    const file = `${id}.md`
    writeFileSync(join(contentDir, file), body.endsWith('\n') ? body : `${body}\n`, 'utf-8')
    written.push(file)
  }

  return { contentDir, meta, written }
}
