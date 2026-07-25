import type {
  WeeklySeoReport,
  Ga4SegmentSummary,
  GscQueryRanking,
  LandingPageMetric,
} from '@/lib/buildWeeklySeoReport'
import type { SlackMessagePayload } from '@/lib/slackClient'
import { getWeekdayIndex } from '@/lib/dateUtils'

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const
const LP_PATH_MAX_LEN = 50

function formatWeekday(dateStr: string): string {
  return WEEKDAYS_JA[getWeekdayIndex(dateStr)]
}

function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP')
}

function formatYoYSuffix(percent: number | null): string {
  if (percent === null) return '（前年同週 —）'
  const sign = percent > 0 ? '+' : ''
  return `（前年同週 ${sign}${percent.toFixed(1)}%）`
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

function shortenPath(path: string): string {
  if (path.length <= LP_PATH_MAX_LEN) return path
  return `${path.slice(0, LP_PATH_MAX_LEN - 3)}...`
}

function formatWeekRange(report: WeeklySeoReport): string {
  return `${report.weekStart}(${formatWeekday(report.weekStart)})〜${report.weekEnd}(${formatWeekday(report.weekEnd)})`
}

function formatRankingLine(rank: number, q: GscQueryRanking): string {
  const query = q.query || '(不明)'
  return `${rank}. ${query} — クリック *${formatNumber(q.clicks)}* / 順位 ${q.position.toFixed(1)} / CTR ${q.ctr.toFixed(2)}%`
}

function formatLandingLine(rank: number, lp: LandingPageMetric): string {
  return `${rank}. \`${shortenPath(lp.path)}\` — セッション *${formatNumber(lp.sessions)}* / 貢献CV *${formatNumber(lp.transactions)}* / CVR ${lp.cvr.toFixed(2)}%`
}

function formatCvLandingLine(rank: number, lp: LandingPageMetric): string {
  return `${rank}. \`${shortenPath(lp.path)}\` — 貢献CV *${formatNumber(lp.transactions)}* / 貢献売上 *¥${formatNumber(lp.revenue)}* / セッション ${formatNumber(lp.sessions)}`
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

function buildHeaderText(report: WeeklySeoReport): string {
  return `:bar_chart: Weekly KPI Bot — ${formatWeekRange(report)}`
}

function buildGscThreadText(report: WeeklySeoReport): string {
  const rankingLines =
    report.gsc.topQueries.length > 0
      ? report.gsc.topQueries.map((q, i) => formatRankingLine(i + 1, q))
      : ['データなし']

  return [
    `*GSC クリック数 上位キーワード TOP10（${formatWeekRange(report)}）*`,
    ...rankingLines,
  ].join('\n')
}

function formatSegmentRow(s: Ga4SegmentSummary): string {
  const label = s.label.padEnd(12, ' ')
  return `${label}  ${formatNumber(s.sessions).padStart(7)}  ${formatNumber(s.transactions).padStart(6)}  ¥${formatNumber(s.revenue).padStart(10)}  ${s.cvr.toFixed(1)}%`
}

function buildSegmentThreadText(report: WeeklySeoReport): string {
  const yoyRange = `${report.yoyWeekStart}〜${report.yoyWeekEnd}`
  const lines = [
    `*GA4 セグメント概況（${formatWeekRange(report)}）*`,
    '```',
    '                セッション  貢献CV        貢献売上      CVR',
    ...report.ga4Segments.map(formatSegmentRow),
    '```',
    '',
    `*トータル 前年同週比*（${yoyRange}・52週前）`,
    formatGa4MetricLine('セッション', report.ga4.sessions, report.ga4.yoyPercent.sessions),
    formatGa4MetricLine('貢献CV', report.ga4.transactions, report.ga4.yoyPercent.transactions),
    formatGa4MetricLine('貢献売上', report.ga4.revenue, report.ga4.yoyPercent.revenue, { prefix: '¥' }),
    '',
    `_※マガジンLP = landingPage に ${report.magazinePrefix} を含むセッション_`,
    '_※CV・売上は GA4 キーイベント帰属（30日ルックバック）。セッション数は週内の landingPage セッション。_',
  ]
  return lines.join('\n')
}

function buildLandingSessionsThreadText(report: WeeklySeoReport): string {
  const { topBySessions } = report.landingPages
  const allLines =
    topBySessions.all.length > 0
      ? topBySessions.all.map((lp, i) => formatLandingLine(i + 1, lp))
      : ['データなし']
  const magLines =
    topBySessions.magazine.length > 0
      ? topBySessions.magazine.map((lp, i) => formatLandingLine(i + 1, lp))
      : ['データなし']

  return [
    '*ランディングページ TOP5（セッション数）*',
    '',
    '*サイト全体*',
    ...allLines,
    '',
    `*マガジン（${report.magazinePrefix}）*`,
    ...magLines,
  ].join('\n')
}

function buildLandingCvThreadText(report: WeeklySeoReport): string {
  const { topByCv } = report.landingPages
  const allLines =
    topByCv.all.length > 0
      ? topByCv.all.map((lp, i) => formatCvLandingLine(i + 1, lp))
      : ['データなし']
  const magLines =
    topByCv.magazine.length > 0
      ? topByCv.magazine.map((lp, i) => formatCvLandingLine(i + 1, lp))
      : ['データなし']

  return [
    '*ランディングページ TOP5（貢献CV・貢献売上）*',
    '',
    '*サイト全体*',
    ...allLines,
    '',
    `*マガジン（${report.magazinePrefix}）*`,
    ...magLines,
    '',
    '_※CV・売上は GA4 キーイベント帰属（30日ルックバック）。セッション数は週内の landingPage セッション。_',
  ].join('\n')
}

/** 親メッセージ（タイトル + 週間期間） */
export function formatSeoWeeklyParentMessage(report: WeeklySeoReport): SlackMessagePayload {
  return toPayload(buildHeaderText(report))
}

/** スレッド返信 4 件（GSC / セグメント / LP セッション / LP 貢献） */
export function formatSeoWeeklyThreadMessages(report: WeeklySeoReport): SlackMessagePayload[] {
  return [
    toPayload(buildGscThreadText(report)),
    toPayload(buildSegmentThreadText(report)),
    toPayload(buildLandingSessionsThreadText(report)),
    toPayload(buildLandingCvThreadText(report)),
  ]
}

/** Webhook フォールバック用: 全スレッドを1通にまとめる */
export function formatSeoWeeklyMessage(report: WeeklySeoReport): SlackMessagePayload {
  const parts = [
    buildHeaderText(report),
    buildGscThreadText(report),
    buildSegmentThreadText(report),
    buildLandingSessionsThreadText(report),
    buildLandingCvThreadText(report),
  ]
  return toPayload(parts.join('\n\n---\n\n'))
}
