import { splitMonthlyReportMarkdown } from './monthlyReportSections'

const SAMPLE = `# タイトル

**対象期間（現在）**: 2026-08-01 〜 2026-08-31

### 注記

- note

---

## エグゼクティブサマリー

| 指標 | 現在 |
|------|------|
| クリック | 1 |

---

## サイト全体 — Google Search Console

GSC body

## サイト全体 — GA4（集客・購入）

GA4 body

## /magazine/ — GSC

mag gsc

## /magazine/ — GA4（トラフィック）

mag ga4

## 直近13ヶ月の推移

trends
`

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const parts = splitMonthlyReportMarkdown(SAMPLE)
assert(parts.summary?.includes('エグゼクティブサマリー'), 'summary has h2')
assert(parts.summary?.includes('対象期間'), 'summary keeps preamble')
assert(parts['site-gsc']?.startsWith('## サイト全体 — Google Search Console'), 'site-gsc')
assert(parts['site-ga4']?.includes('GA4 body'), 'site-ga4')
assert(parts['magazine-gsc']?.includes('mag gsc'), 'magazine-gsc')
assert(parts['magazine-ga4']?.includes('mag ga4'), 'magazine-ga4')
assert(parts.trends?.includes('trends'), 'trends')
assert(!parts.summary?.includes('GSC body'), 'summary excludes other sections')

console.log('monthlyReportSections.test.ts: ok')
