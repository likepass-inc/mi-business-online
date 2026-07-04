export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  }
}

/**
 * 終端日を「今日から endOffsetDays 日前」にした直近 days 日（両端含む）。
 * GSC の反映遅延を考慮する場合は endOffsetDays: 1（昨日まで）が無難。
 */
export function getDateRangeDaysEndingWithOffset(
  days: number,
  options?: { endOffsetDays?: number }
): { startDate: string; endDate: string } {
  const endOffset = options?.endOffsetDays ?? 1
  const end = new Date()
  end.setDate(end.getDate() - endOffset)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  }
}

export function getPreviousPeriod(
  startDate: string,
  endDate: string
): { startDate: string; endDate: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - diffDays)
  
  return {
    startDate: formatDate(prevStart),
    endDate: formatDate(prevEnd),
  }
}

/** Asia/Tokyo（JST）での「今日」を YYYY-MM-DD で返す */
export function getTodayJst(): string {
  // en-CA ロケールは YYYY-MM-DD 形式を返す
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

/**
 * YYYY-MM-DD を days 日シフト（負数で過去）。
 * UTC 正午を基準に計算するため、実行環境のタイムゾーンに依存しない。
 */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/** YYYY-MM-DD の曜日（0=日〜6=土）を環境非依存で返す */
export function getWeekdayIndex(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay()
}

/** YYYY-MM-DD の前年同日を返す（UTC 正午基準、実行環境のタイムゾーンに依存しない） */
export function getSameDayLastYear(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() - 1)
  return d.toISOString().split('T')[0]
}

// 前年同時期の日付範囲を計算
/** GSC 反映遅延を考慮したデイリー SEO 対象日と比較日（前日・前週同曜日）。JST 基準。 */
export function getDailySeoDates(options?: { offsetDays?: number }): {
  targetDate: string
  previousDay: string
  previousWeek: string
} {
  const offset = options?.offsetDays ?? Number(process.env.SEO_DAILY_OFFSET_DAYS ?? 3)
  const targetDate = shiftDate(getTodayJst(), -offset)
  return {
    targetDate,
    previousDay: shiftDate(targetDate, -1),
    previousWeek: shiftDate(targetDate, -7),
  }
}

export function getYearOverYearPeriod(
  startDate: string,
  endDate: string
): { startDate: string; endDate: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // 1年前の同じ日付を計算
  const yoyStart = new Date(start)
  yoyStart.setFullYear(yoyStart.getFullYear() - 1)
  
  const yoyEnd = new Date(end)
  yoyEnd.setFullYear(yoyEnd.getFullYear() - 1)
  
  return {
    startDate: formatDate(yoyStart),
    endDate: formatDate(yoyEnd),
  }
}

