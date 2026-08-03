/**
 * 検索クエリ文字列から季節依存の目安ラベル（ルールベース）
 */

/** 小文字化してマッチ（ひらがな・カタカナ・漢字の代表的パターン） */
const SEASONAL_SUBSTRINGS = [
  'お歳暮',
  'おせいぼ',
  '歳暮',
  'せいぼ',
  'お中元',
  'おちゅうげん',
  '中元',
  'ちゅうげん',
  '暑中',
  'お年賀',
  '年賀',
  'バレンタイン',
  'ホワイトデー',
  '母の日',
  '父の日',
  'クリスマス',
  'ひなまつり',
  '端午',
]

export type QuerySeasonLabel = 'seasonal' | 'evergreen'

export function classifyQuerySeason(query: string): QuerySeasonLabel {
  const q = query.trim()
  if (!q) return 'evergreen'
  for (const s of SEASONAL_SUBSTRINGS) {
    if (q.includes(s)) return 'seasonal'
  }
  return 'evergreen'
}

export interface PortfolioSeasonSummary {
  seasonalClicks: number
  evergreenClicks: number
  seasonalImpressions: number
  evergreenImpressions: number
  seasonalQueryRows: number
  evergreenQueryRows: number
}

/**
 * GSC query 行の配列から、季節ラベル別にクリック・インプレッションを集計
 */
export function summarizeQueryPortfolioBySeason(rows: Array<{ query: string; clicks: number; impressions: number }>): PortfolioSeasonSummary {
  let seasonalClicks = 0
  let evergreenClicks = 0
  let seasonalImpressions = 0
  let evergreenImpressions = 0
  let seasonalQueryRows = 0
  let evergreenQueryRows = 0

  for (const row of rows) {
    const label = classifyQuerySeason(row.query)
    if (label === 'seasonal') {
      seasonalClicks += row.clicks
      seasonalImpressions += row.impressions
      seasonalQueryRows += 1
    } else {
      evergreenClicks += row.clicks
      evergreenImpressions += row.impressions
      evergreenQueryRows += 1
    }
  }

  return {
    seasonalClicks,
    evergreenClicks,
    seasonalImpressions,
    evergreenImpressions,
    seasonalQueryRows,
    evergreenQueryRows,
  }
}
