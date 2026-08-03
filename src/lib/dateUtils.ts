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

/** YYYY-MM-DD の52週前（364日前・同曜日）を返す。法人向け KPI の前年同曜日比較用。 */
export function getSameWeekdayLastYear(dateStr: string): string {
  return shiftDate(dateStr, -364)
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

export interface WeeklySeoPeriod {
  weekStart: string
  weekEnd: string
  weekKey: string
  yoyWeekStart: string
  yoyWeekEnd: string
}

/**
 * 直前の完全週（日曜〜土曜）を JST 基準で返す。
 * 月曜実行時は weekEnd = 土曜（today - 2）。土曜当日実行時は前週土曜まで。
 */
export function getWeeklySeoPeriod(referenceDate?: string): WeeklySeoPeriod {
  const today = referenceDate ?? getTodayJst()
  const weekday = getWeekdayIndex(today)
  let daysSinceSaturday = (weekday + 1) % 7
  if (daysSinceSaturday === 0) daysSinceSaturday = 7

  const weekEnd = shiftDate(today, -daysSinceSaturday)
  const weekStart = shiftDate(weekEnd, -6)
  const weekKey = `${weekStart}_${weekEnd}`

  return {
    weekStart,
    weekEnd,
    weekKey,
    yoyWeekStart: shiftDate(weekStart, -364),
    yoyWeekEnd: shiftDate(weekEnd, -364),
  }
}

export interface MonthlySeoPeriod {
  monthStart: string
  monthEnd: string
  monthKey: string
  yoyMonthStart: string
  yoyMonthEnd: string
}

/** 暦月の末日（calendarMonth は 1〜12） */
export function getLastDayOfCalendarMonth(year: number, calendarMonth: number): number {
  return new Date(Date.UTC(year, calendarMonth, 0)).getUTCDate()
}

/**
 * 直前の暦月（1日〜末日）を JST 基準で返す。
 * 例: 2026-08-03 実行 → 2026-07-01 〜 2026-07-31
 */
export function getMonthlySeoPeriod(referenceDate?: string): MonthlySeoPeriod {
  const today = referenceDate ?? getTodayJst()
  const [yearStr, monthStr] = today.split('-')
  let year = parseInt(yearStr, 10)
  let month = parseInt(monthStr, 10)

  month -= 1
  if (month === 0) {
    month = 12
    year -= 1
  }

  const monthPadded = String(month).padStart(2, '0')
  const monthStart = `${year}-${monthPadded}-01`
  const lastDay = getLastDayOfCalendarMonth(year, month)
  const monthEnd = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`
  const monthKey = `${year}-${monthPadded}`

  const { startDate: yoyMonthStart, endDate: yoyMonthEnd } = getYearOverYearPeriod(
    monthStart,
    monthEnd
  )

  return {
    monthStart,
    monthEnd,
    monthKey,
    yoyMonthStart,
    yoyMonthEnd,
  }
}
