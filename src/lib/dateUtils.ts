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

