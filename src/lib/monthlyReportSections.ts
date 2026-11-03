/**
 * 月次レポートのセクション定義と Markdown 分割。
 * CLI 生成と content/monthly 閲覧で共有する。
 */

export const MONTHLY_SECTION_IDS = [
  'summary',
  'site-gsc',
  'site-ga4',
  'magazine-gsc',
  'magazine-ga4',
  'trends',
] as const

export type MonthlySectionId = (typeof MONTHLY_SECTION_IDS)[number]

export interface MonthlySectionDef {
  id: MonthlySectionId
  title: string
  description: string
  /** 包括 Markdown の H2 見出しにマッチ */
  h2Pattern: RegExp
}

export const MONTHLY_SECTION_DEFS: MonthlySectionDef[] = [
  {
    id: 'summary',
    title: '統合サマリー',
    description: 'エグゼクティブサマリーと注記',
    h2Pattern: /^エグゼクティブサマリー/,
  },
  {
    id: 'site-gsc',
    title: 'サイト GSC',
    description: 'クリック・露出・クエリ・LP',
    h2Pattern: /^サイト全体 — Google Search Console/,
  },
  {
    id: 'site-ga4',
    title: 'サイト GA4',
    description: 'セッション・購入・チャネル・デバイス',
    h2Pattern: /^サイト全体 — GA4/,
  },
  {
    id: 'magazine-gsc',
    title: 'マガジン GSC',
    description: '/magazine/ の検索指標',
    h2Pattern: /^\/magazine\/ — GSC/,
  },
  {
    id: 'magazine-ga4',
    title: 'マガジン GA4',
    description: '/magazine/ のトラフィック',
    h2Pattern: /^\/magazine\/ — GA4/,
  },
  {
    id: 'trends',
    title: '13ヶ月推移',
    description: '直近13ヶ月の KPI 推移',
    h2Pattern: /^直近13ヶ月の推移/,
  },
]

export function isMonthlySectionId(value: string): value is MonthlySectionId {
  return (MONTHLY_SECTION_IDS as readonly string[]).includes(value)
}

export function getMonthlySectionDef(id: MonthlySectionId): MonthlySectionDef {
  const def = MONTHLY_SECTION_DEFS.find((d) => d.id === id)
  if (!def) throw new Error(`Unknown monthly section: ${id}`)
  return def
}

interface H2Chunk {
  title: string
  body: string
}

function splitByH2(markdown: string): { preamble: string; chunks: H2Chunk[] } {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const chunks: H2Chunk[] = []
  let preambleLines: string[] = []
  let current: H2Chunk | null = null

  for (const line of lines) {
    const h2 = /^##\s+(.+)$/.exec(line)
    if (h2) {
      if (current) chunks.push(current)
      current = { title: h2[1].trim(), body: `${line}\n` }
      continue
    }
    if (current) {
      current.body += `${line}\n`
    } else {
      preambleLines.push(line)
    }
  }
  if (current) chunks.push(current)

  return {
    preamble: preambleLines.join('\n').replace(/\n+$/, '\n'),
    chunks,
  }
}

/**
 * 包括レポート Markdown をセクション別ファイル内容に分割する。
 * summary には先頭メタ・注記 + エグゼクティブサマリーを含める。
 */
export function splitMonthlyReportMarkdown(
  markdown: string
): Partial<Record<MonthlySectionId, string>> {
  const { preamble, chunks } = splitByH2(markdown)
  const result: Partial<Record<MonthlySectionId, string>> = {}

  for (const chunk of chunks) {
    const def = MONTHLY_SECTION_DEFS.find((d) => d.h2Pattern.test(chunk.title))
    if (!def) continue
    const body = chunk.body.replace(/\n+$/, '\n')
    if (def.id === 'summary') {
      const head = preamble.trimEnd()
      result.summary = head ? `${head}\n\n${body}` : body
    } else {
      result[def.id] = body
    }
  }

  return result
}

export interface MonthlyReportMeta {
  monthKey: string
  label: string
  periodStart: string
  periodEnd: string
  yoyPeriodStart?: string
  yoyPeriodEnd?: string
  generatedAt: string
  sources: string[]
  listTitle: string
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}年${parseInt(month, 10)}月`
}

export function buildMonthlyReportMeta(input: {
  monthKey: string
  periodStart: string
  periodEnd: string
  yoyPeriodStart?: string
  yoyPeriodEnd?: string
  generatedAt?: string
}): MonthlyReportMeta {
  const label = formatMonthLabel(input.monthKey)
  return {
    monthKey: input.monthKey,
    label,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    yoyPeriodStart: input.yoyPeriodStart,
    yoyPeriodEnd: input.yoyPeriodEnd,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sources: ['Google Search Console', 'GA4'],
    listTitle: `${label} 集客・売上`,
  }
}
