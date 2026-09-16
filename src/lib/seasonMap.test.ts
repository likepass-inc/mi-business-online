import assert from 'node:assert/strict'
import {
  DEFAULT_SEASON_MAP_ACTIVE_AT,
  getSeasonMapEntries,
  getSuccessorEntry,
  isSeasonMapActive,
  normalizeProductCode,
  resolveSeasonSuccessor,
  shopProductCode,
} from './seasonMap'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}`)
    throw e
  }
}

test('relative map has 466 unique pairs', () => {
  const entries = getSeasonMapEntries()
  assert.equal(entries.length, 466)
  assert.equal(new Set(entries.map((e) => e.from)).size, 466)
  assert.equal(new Set(entries.map((e) => e.to)).size, 466)
})

test('normalizeProductCode strips leading g and lowercases', () => {
  assert.equal(normalizeProductCode('gR600-303S26'), 'r600-303s26')
  assert.equal(normalizeProductCode('R600-303S26'), 'r600-303s26')
  assert.equal(normalizeProductCode('GR600-303F26'), 'r600-303f26')
})

test('shopProductCode prefixes g when missing', () => {
  assert.equal(shopProductCode('R600-303F26'), 'gR600-303F26')
  assert.equal(shopProductCode('gR600-303F26'), 'gR600-303F26')
})

test('suffix-only rewrite would miss the three M→R exceptions', () => {
  const exceptions = getSeasonMapEntries().filter(
    (entry) => !(entry.from.endsWith('S26') && entry.to.endsWith('F26') && entry.from.slice(0, -3) === entry.to.slice(0, -3))
  )
  assert.deepEqual(
    exceptions.map((entry) => [entry.from, entry.to]),
    [
      ['M674-413S26', 'R674-413F26'],
      ['M679-173S26', 'R679-173F26'],
      ['M679-293S26', 'R679-293F26'],
    ]
  )
  assert.equal(getSuccessorEntry('M674-413S26')?.to, 'R674-413F26')
  assert.equal(getSuccessorEntry('gM674-413S26')?.to, 'R674-413F26')
})

test('same-base pairs map S26 to F26', () => {
  assert.equal(getSuccessorEntry('R600-303S26')?.to, 'R600-303F26')
  assert.equal(getSuccessorEntry('gR600-303S26')?.to, 'R600-303F26')
  assert.equal(getSuccessorEntry('R600-303F26'), null)
})

test('time gate stays inactive before 2026-09-18 10:00 JST', () => {
  const env = { SEASON_MAP_ACTIVE_AT: DEFAULT_SEASON_MAP_ACTIVE_AT }
  assert.equal(isSeasonMapActive(new Date('2026-09-18T00:59:59.000Z'), env), false)
  assert.equal(resolveSeasonSuccessor('R600-303S26', new Date('2026-09-18T00:59:59.000Z'), env), null)
})

test('time gate activates at 2026-09-18 10:00 JST', () => {
  const env = { SEASON_MAP_ACTIVE_AT: DEFAULT_SEASON_MAP_ACTIVE_AT }
  assert.equal(isSeasonMapActive(new Date('2026-09-18T01:00:00.000Z'), env), true)
  assert.equal(resolveSeasonSuccessor('gR600-303S26', new Date('2026-09-18T01:00:00.000Z'), env)?.to, 'R600-303F26')
})

test('SEASON_MAP_ACTIVE_AT override can force the map on or off', () => {
  assert.equal(isSeasonMapActive(new Date('2026-01-01T00:00:00.000Z'), { SEASON_MAP_ACTIVE_AT: '2020-01-01T00:00:00.000Z' }), true)
  assert.equal(isSeasonMapActive(new Date('2099-01-01T00:00:00.000Z'), { SEASON_MAP_ACTIVE_AT: '2099-06-01T00:00:00.000Z' }), false)
})

console.log('\nAll seasonMap tests passed.')
