import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import type { MonthlyChartsPayload } from '@/lib/monthlyChartsTypes'
import {
  getMonthlySectionDef,
  isMonthlySectionId,
  MONTHLY_SECTION_DEFS,
  type MonthlyReportMeta,
  type MonthlySectionId,
} from '@/lib/monthlyReportSections'

const CONTENT_ROOT = join(process.cwd(), 'content', 'monthly')

export interface MonthlyReportListItem {
  monthKey: string
  label: string
  listTitle: string
  periodStart: string
  periodEnd: string
}

export interface MonthlyReportHub {
  meta: MonthlyReportMeta
  sections: Array<{
    id: MonthlySectionId
    title: string
    description: string
  }>
}

export interface MonthlyReportSectionContent {
  meta: MonthlyReportMeta
  sectionId: MonthlySectionId
  title: string
  description: string
  markdown: string
}

function monthDir(monthKey: string): string {
  return join(CONTENT_ROOT, monthKey)
}

function readMeta(monthKey: string): MonthlyReportMeta | null {
  const path = join(monthDir(monthKey), 'meta.json')
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as MonthlyReportMeta
    if (!raw.monthKey || !raw.label) return null
    return raw
  } catch {
    return null
  }
}

function availableSectionIds(monthKey: string): MonthlySectionId[] {
  const dir = monthDir(monthKey)
  return MONTHLY_SECTION_DEFS.filter((d) => existsSync(join(dir, `${d.id}.md`))).map(
    (d) => d.id
  )
}

/** YYYY-MM 形式のみ許可 */
export function isValidMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value)
}

export function listMonthlyReports(): MonthlyReportListItem[] {
  if (!existsSync(CONTENT_ROOT)) return []

  const entries = readdirSync(CONTENT_ROOT, { withFileTypes: true })
  const items: MonthlyReportListItem[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidMonthKey(entry.name)) continue
    const meta = readMeta(entry.name)
    if (!meta) continue
    if (availableSectionIds(entry.name).length === 0) continue
    items.push({
      monthKey: meta.monthKey,
      label: meta.label,
      listTitle: meta.listTitle || `${meta.label} 集客・売上`,
      periodStart: meta.periodStart,
      periodEnd: meta.periodEnd,
    })
  }

  return items.sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}

export function getMonthlyReport(monthKey: string): MonthlyReportHub | null {
  if (!isValidMonthKey(monthKey)) return null
  const meta = readMeta(monthKey)
  if (!meta) return null
  const ids = availableSectionIds(monthKey)
  if (ids.length === 0) return null

  return {
    meta,
    sections: ids.map((id) => {
      const def = getMonthlySectionDef(id)
      return { id, title: def.title, description: def.description }
    }),
  }
}

export function getMonthlySection(
  monthKey: string,
  sectionId: string
): MonthlyReportSectionContent | null {
  if (!isValidMonthKey(monthKey) || !isMonthlySectionId(sectionId)) return null
  const meta = readMeta(monthKey)
  if (!meta) return null

  const path = join(monthDir(monthKey), `${sectionId}.md`)
  if (!existsSync(path)) return null

  const def = getMonthlySectionDef(sectionId)
  return {
    meta,
    sectionId,
    title: def.title,
    description: def.description,
    markdown: readFileSync(path, 'utf-8'),
  }
}

export function getMonthlyCharts(monthKey: string): MonthlyChartsPayload | null {
  if (!isValidMonthKey(monthKey)) return null
  const path = join(monthDir(monthKey), 'charts.json')
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as MonthlyChartsPayload
  } catch {
    return null
  }
}
