import assert from 'node:assert/strict'
import {
  getLastDayOfCalendarMonth,
  getMonthlyCalendarPeriods,
  getMonthlySeoPeriod,
} from './dateUtils'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}`)
    throw e
  }
}

test('getLastDayOfCalendarMonth handles leap year February', () => {
  assert.equal(getLastDayOfCalendarMonth(2024, 2), 29)
  assert.equal(getLastDayOfCalendarMonth(2025, 2), 28)
})

test('getLastDayOfCalendarMonth handles 31-day months', () => {
  assert.equal(getLastDayOfCalendarMonth(2026, 7), 31)
  assert.equal(getLastDayOfCalendarMonth(2026, 4), 30)
})

test('getMonthlySeoPeriod returns previous calendar month', () => {
  const period = getMonthlySeoPeriod('2026-08-03')
  assert.equal(period.monthStart, '2026-07-01')
  assert.equal(period.monthEnd, '2026-07-31')
  assert.equal(period.monthKey, '2026-07')
  assert.equal(period.yoyMonthStart, '2025-07-01')
  assert.equal(period.yoyMonthEnd, '2025-07-31')
})

test('getMonthlySeoPeriod handles January reference (previous December)', () => {
  const period = getMonthlySeoPeriod('2026-01-05')
  assert.equal(period.monthStart, '2025-12-01')
  assert.equal(period.monthEnd, '2025-12-31')
  assert.equal(period.monthKey, '2025-12')
  assert.equal(period.yoyMonthStart, '2024-12-01')
  assert.equal(period.yoyMonthEnd, '2024-12-31')
})

test('getMonthlySeoPeriod handles March reference after leap February', () => {
  const period = getMonthlySeoPeriod('2024-03-04')
  assert.equal(period.monthStart, '2024-02-01')
  assert.equal(period.monthEnd, '2024-02-29')
  assert.equal(period.monthKey, '2024-02')
})

test('getMonthlyCalendarPeriods returns 13 months ending at endMonthKey', () => {
  const periods = getMonthlyCalendarPeriods('2026-07', 13)
  assert.equal(periods.length, 13)
  assert.equal(periods[0].monthKey, '2025-07')
  assert.equal(periods[12].monthKey, '2026-07')
  assert.equal(periods[0].monthStart, '2025-07-01')
  assert.equal(periods[12].monthEnd, '2026-07-31')
})

test('getMonthlyCalendarPeriods handles year boundary', () => {
  const periods = getMonthlyCalendarPeriods('2026-02', 3)
  assert.deepEqual(
    periods.map((p) => p.monthKey),
    ['2025-12', '2026-01', '2026-02']
  )
})

console.log('\nAll dateUtils tests passed.')
