import type {
  DailySeoReport,
  Ga4SegmentSummary,
  GscQueryRanking,
  LandingPageMetric,
} from '@/lib/buildDailySeoReport'
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

function shortenPath(path: string): string {
  if (path.length <= LP_PATH_MAX_LEN) return path
  return `${path.slice(0, LP_PATH_MAX_LEN - 3)}...`
}

function formatRankingLine(rank: number, q: GscQueryRanking): string {
  const query = q.query || '(不明)'
  return `${rank}. ${query} — クリック *${formatNumber(q.clicks)}* / 順位 ${q.position.toFixed(1)} / CTR ${q.ctr.toFixed(2)}%`
}

function formatLandingLine(rank: number, lp: LandingPageMetric): string {
  return `${rank}. \`${shortenPath(lp.path)}\` — セッション *${formatNumber(lp.sessions)}* / CV *${formatNumber(lp.transactions)}* / CVR ${lp.cvr.toFixed(2)}%`
}

function formatCvLandingLine(rank: number, lp: LandingPageMetric): string {
  return `${rank}. \`${shortenPath(lp.path)}\` — CV *${formatNumber(lp.transactions)}* / セッション ${formatNumber(lp.sessions)} / CVR ${lp.cvr.toFixed(2)}%`
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

function buildHeaderText(report: DailySeoReport): string {
  const weekday = formatWeekday(report.targetDate)
  return `:bar_chart: Daily KPI Bot — ${report.targetDate}(${weekday})`
}

function buildGscThreadText(report: DailySeoReport): string {
  const rankingLines =
    report.gsc.topQueries.length > 0
      ? report.gsc.topQueries.map((q, i) => formatRankingLine(i + 1, q))
      : ['データなし']

  return ['*GSC クリック数 上位キーワード TOP10*', ...rankingLines].join('\n')
}

function formatSegmentRow(s: Ga4SegmentSummary): string {
  const label = s.label.padEnd(12, ' ')
  return `${label}  ${formatNumber(s.sessions).padStart(7)}  ${formatNumber(s.transactions).padStart(4)}  ¥${formatNumber(s.revenue).padStart(10)}  ${s.cvr.toFixed(1)}%`
}

function buildSegmentThreadText(report: DailySeoReport): string {
  const lines = [
    `*GA4 セグメント概況（${report.targetDate}）*`,
    '```',
    '                セッション    CV        売上      CVR',
    ...report.ga4Segments.map(formatSegmentRow),
    '```',
    '',
    `*トータル 前年同曜日比*（${report.yoyCompareDate}・${formatWeekday(report.yoyCompareDate)}・52週前）`,
    formatGa4MetricLine('セッション', report.ga4.sessions, report.ga4.yoyPercent.sessions),
    formatGa4MetricLine('購入完了', report.ga4.transactions, report.ga4.yoyPercent.transactions),
    formatGa4MetricLine('売上', report.ga4.revenue, report.ga4.yoyPercent.revenue, { prefix: '¥' }),
    '',
    `_※マガジンLP = landingPage に ${report.magazinePrefix} を含むセッション_`,
  ]
  return lines.join('\n')
}

function buildLandingSessionsThreadText(report: DailySeoReport): string {
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

function buildLandingCvThreadText(report: DailySeoReport): string {
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
    '*ランディングページ TOP5（CV 貢献）*',
    '',
    '*サイト全体*',
    ...allLines,
    '',
    `*マガジン（${report.magazinePrefix}）*`,
    ...magLines,
    '',
    '_※CV はランディングページへのセッション帰属_',
  ].join('\n')
}

/** 親メッセージ（タイトル + 日付） */
export function formatSeoDailyParentMessage(report: DailySeoReport): SlackMessagePayload {
  return toPayload(buildHeaderText(report))
}

/** スレッド返信 4 件（GSC / セグメント / LP セッション / LP CV） */
export function formatSeoDailyThreadMessages(report: DailySeoReport): SlackMessagePayload[] {
  return [
    toPayload(buildGscThreadText(report)),
    toPayload(buildSegmentThreadText(report)),
    toPayload(buildLandingSessionsThreadText(report)),
    toPayload(buildLandingCvThreadText(report)),
  ]
}

/** 後方互換: 旧 1 スレッド詳細（GSC のみ） */
export function formatSeoDailyDetailMessage(report: DailySeoReport): SlackMessagePayload {
  return toPayload(buildGscThreadText(report))
}

/** Webhook フォールバック用: 全スレッドを1通にまとめる */
export function formatSeoDailyMessage(report: DailySeoReport): SlackMessagePayload {
  const parts = [
    buildHeaderText(report),
    buildGscThreadText(report),
    buildSegmentThreadText(report),
    buildLandingSessionsThreadText(report),
    buildLandingCvThreadText(report),
  ]
  return toPayload(parts.join('\n\n---\n\n'))
}
