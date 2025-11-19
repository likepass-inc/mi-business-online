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

// 前年同時期の日付範囲を計算
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

