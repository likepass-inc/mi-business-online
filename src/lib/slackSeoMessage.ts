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
    '*GA4（当日）*',
    `セッション *${formatNumber(report.ga4.sessions)}*`,
    `購入完了 *${formatNumber(report.ga4.transactions)}*`,
    `売上 *¥${formatNumber(report.ga4.revenue)}*`,
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
