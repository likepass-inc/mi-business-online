import type { DailySeoReport, GscQueryRanking } from '@/lib/buildDailySeoReport'
import type { SlackMessagePayload } from '@/lib/slackClient'
import { getWeekdayIndex } from '@/lib/dateUtils'

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

function formatWeekday(dateStr: string): string {
  return WEEKDAYS_JA[getWeekdayIndex(dateStr)]
}

function formatSiteLabel(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname
  } catch {
    return siteUrl
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP')
}

function formatYoYSuffix(percent: number | null): string {
  if (percent === null) return '（前年同曜日 —）'
  const sign = percent > 0 ? '+' : ''
  return `（前年同曜日 ${sign}${percent.toFixed(1)}%）`
}

function formatGa4MetricLine(
  label: string,
  value: number,
  yoyPercent: number | null,
  options?: { prefix?: string }
): string {
  const prefix = options?.prefix ?? ''
  return `${label} *${prefix}${formatNumber(value)}*${formatYoYSuffix(yoyPercent)}`
}

function formatRankingLine(rank: number, q: GscQueryRanking): string {
  const query = q.query || '(不明)'
  return `${rank}. ${query} — クリック *${formatNumber(q.clicks)}* / 順位 ${q.position.toFixed(1)} / CTR ${q.ctr.toFixed(2)}%`
}

function buildHeaderText(report: DailySeoReport): string {
  const siteLabel = formatSiteLabel(report.siteUrl)
  const weekday = formatWeekday(report.targetDate)
  return `:bar_chart: SEO デイリー (${siteLabel}) — ${report.targetDate}(${weekday})`
}

function buildDetailText(report: DailySeoReport): string {
  const rankingLines =
    report.gsc.topQueries.length > 0
      ? report.gsc.topQueries.map((q, i) => formatRankingLine(i + 1, q))
      : ['データなし']

  const lines = [
    '*GSC クリック数 上位キーワード TOP10*',
    ...rankingLines,
    '',
    '*GA4（対象日）*',
    `比較: ${report.yoyCompareDate}（${formatWeekday(report.yoyCompareDate)}・52週前）`,
    formatGa4MetricLine('セッション', report.ga4.sessions, report.ga4.yoyPercent.sessions),
    formatGa4MetricLine('購入完了', report.ga4.transactions, report.ga4.yoyPercent.transactions),
    formatGa4MetricLine('売上', report.ga4.revenue, report.ga4.yoyPercent.revenue, { prefix: '¥' }),
  ]
  return lines.join('\n')
}

function toPayload(text: string): SlackMessagePayload {
  return {
    text,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text },
      },
    ],
  }
}

/** 親メッセージ（タイトル + 日付） */
export function formatSeoDailyParentMessage(report: DailySeoReport): SlackMessagePayload {
  return toPayload(buildHeaderText(report))
}

/** スレッド内に投稿する詳細メッセージ */
export function formatSeoDailyDetailMessage(report: DailySeoReport): SlackMessagePayload {
  return toPayload(buildDetailText(report))
}

/** Webhook フォールバック用: 親メッセージと詳細を1通にまとめる */
export function formatSeoDailyMessage(report: DailySeoReport): SlackMessagePayload {
  const text = `${buildHeaderText(report)}\n\n${buildDetailText(report)}`
  return toPayload(text)
}
