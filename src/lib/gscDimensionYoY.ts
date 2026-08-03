/**
 * GSC の query / page 行を前年同期と突き合わせるユーティリティ
 */

export interface GscDimensionRow {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscQueryRow = GscDimensionRow & { query: string }
export type GscPageRow = GscDimensionRow & { page: string }

export interface QueryYoYRow {
  query: string
  currentClicks: number
  yearAgoClicks: number
  delta: number
  pctChange: number | null
}

export interface DeclinedRow {
  key: string
  currentClicks: number
  yearAgoClicks: number
  clickDrop: number
  pctChange: number | null
}

/** 伸長（前年同期比でクリックが増えたキー） */
export interface GrowthRow {
  key: string
  currentClicks: number
  yearAgoClicks: number
  clickGain: number
  pctChange: number | null
}

/** Markdown 表セル用（パイプをエスケープ） */
export function mdEscapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

/**
 * 現在期間でクリック上位のキーについて、前年同期のクリックと差分を付与
 */
export function topCurrentWithYoYForQueries(
  currentSorted: GscQueryRow[],
  yearAgo: GscQueryRow[],
  limit: number
): QueryYoYRow[] {
  const yMap = new Map(yearAgo.map((r) => [r.query, r.clicks]))
  return currentSorted.slice(0, limit).map((c) => {
    const yc = yMap.get(c.query) ?? 0
    const delta = c.clicks - yc
    const pctChange = yc > 0 ? (delta / yc) * 100 : null
    return {
      query: c.query,
      currentClicks: c.clicks,
      yearAgoClicks: yc,
      delta,
      pctChange,
    }
  })
}

/**
 * 前年同期に一定以上クリックがあり、現在はそれより少ないキーを「減少」として抽出（クリック減少の大きい順）
 */
export function findDeclinedQueries(
  current: GscQueryRow[],
  yearAgo: GscQueryRow[],
  options?: { minYearAgoClicks?: number; limit?: number }
): DeclinedRow[] {
  const minY = options?.minYearAgoClicks ?? 30
  const limit = options?.limit ?? 20
  const cMap = new Map(current.map((r) => [r.query, r.clicks]))
  return yearAgo
    .filter((y) => y.clicks >= minY)
    .map((y) => {
      const cc = cMap.get(y.query) ?? 0
      const clickDrop = y.clicks - cc
      const pctChange = y.clicks > 0 ? ((cc - y.clicks) / y.clicks) * 100 : null
      return {
        key: y.query,
        currentClicks: cc,
        yearAgoClicks: y.clicks,
        clickDrop,
        pctChange,
      }
    })
    .filter((x) => x.clickDrop > 0)
    .sort((a, b) => b.clickDrop - a.clickDrop)
    .slice(0, limit)
}

/**
 * 前年同期よりクリックが増えたクエリを、増加幅の大きい順に抽出
 */
export function findGrowingQueries(
  current: GscQueryRow[],
  yearAgo: GscQueryRow[],
  options?: { minYearAgoClicks?: number; minGain?: number; limit?: number }
): GrowthRow[] {
  const minY = options?.minYearAgoClicks ?? 30
  const minGain = options?.minGain ?? 1
  const limit = options?.limit ?? 25
  const yMap = new Map(yearAgo.map((r) => [r.query, r.clicks]))
  return current
    .map((c) => {
      const yc = yMap.get(c.query) ?? 0
      const clickGain = c.clicks - yc
      const pctChange = yc > 0 ? ((c.clicks - yc) / yc) * 100 : null
      return {
        key: c.query,
        currentClicks: c.clicks,
        yearAgoClicks: yc,
        clickGain,
        pctChange,
      }
    })
    .filter((x) => {
      if (x.clickGain < minGain) return false
      if (x.yearAgoClicks >= minY) return true
      if (x.yearAgoClicks === 0 && x.currentClicks >= 25) return true
      return false
    })
    .sort((a, b) => b.clickGain - a.clickGain)
    .slice(0, limit)
}

/**
 * 前年同期よりクリックが増えた URL を、増加幅の大きい順に抽出
 */
export function findGrowingPages(
  current: GscPageRow[],
  yearAgo: GscPageRow[],
  options?: { minYearAgoClicks?: number; minGain?: number; limit?: number }
): GrowthRow[] {
  const minY = options?.minYearAgoClicks ?? 20
  const minGain = options?.minGain ?? 1
  const limit = options?.limit ?? 25
  const yMap = new Map(yearAgo.map((r) => [r.page, r.clicks]))
  return current
    .map((c) => {
      const yc = yMap.get(c.page) ?? 0
      const clickGain = c.clicks - yc
      const pctChange = yc > 0 ? ((c.clicks - yc) / yc) * 100 : null
      return {
        key: c.page,
        currentClicks: c.clicks,
        yearAgoClicks: yc,
        clickGain,
        pctChange,
      }
    })
    .filter((x) => {
      if (x.clickGain < minGain) return false
      if (x.yearAgoClicks >= minY) return true
      if (x.yearAgoClicks === 0 && x.currentClicks >= 20) return true
      return false
    })
    .sort((a, b) => b.clickGain - a.clickGain)
    .slice(0, limit)
}

export function topCurrentWithYoYForPages(
  currentSorted: GscPageRow[],
  yearAgo: GscPageRow[],
  limit: number
): Array<{
  page: string
  currentClicks: number
  yearAgoClicks: number
  delta: number
  pctChange: number | null
}> {
  const yMap = new Map(yearAgo.map((r) => [r.page, r.clicks]))
  return currentSorted.slice(0, limit).map((c) => {
    const yc = yMap.get(c.page) ?? 0
    const delta = c.clicks - yc
    const pctChange = yc > 0 ? (delta / yc) * 100 : null
    return {
      page: c.page,
      currentClicks: c.clicks,
      yearAgoClicks: yc,
      delta,
      pctChange,
    }
  })
}

export function findDeclinedPages(
  current: GscPageRow[],
  yearAgo: GscPageRow[],
  options?: { minYearAgoClicks?: number; limit?: number }
): DeclinedRow[] {
  const minY = options?.minYearAgoClicks ?? 20
  const limit = options?.limit ?? 20
  const cMap = new Map(current.map((r) => [r.page, r.clicks]))
  return yearAgo
    .filter((y) => y.clicks >= minY)
    .map((y) => {
      const cc = cMap.get(y.page) ?? 0
      const clickDrop = y.clicks - cc
      const pctChange = y.clicks > 0 ? ((cc - y.clicks) / y.clicks) * 100 : null
      return {
        key: y.page,
        currentClicks: cc,
        yearAgoClicks: y.clicks,
        clickDrop,
        pctChange,
      }
    })
    .filter((x) => x.clickDrop > 0)
    .sort((a, b) => b.clickDrop - a.clickDrop)
    .slice(0, limit)
}
