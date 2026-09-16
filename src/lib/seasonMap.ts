import seasonPairs from '../data/season-maps/26ss-26fw.json'

export const DEFAULT_SEASON_MAP_ACTIVE_AT = '2026-09-18T01:00:00.000Z'

export type SeasonMapEntry = {
  from: string
  to: string
  from_url: string
  to_url: string
  from_name: string
  to_name: string
}

type EnvLike = Record<string, string | undefined>

const entries = (seasonPairs as SeasonMapEntry[]).map((entry) => ({
  from: String(entry.from || '').trim(),
  to: String(entry.to || '').trim(),
  from_url: String(entry.from_url || '').trim(),
  to_url: String(entry.to_url || '').trim(),
  from_name: String(entry.from_name || '').trim(),
  to_name: String(entry.to_name || '').trim(),
}))

const byFrom = new Map<string, SeasonMapEntry>()
const byTo = new Map<string, SeasonMapEntry>()

for (const entry of entries) {
  const fromKey = normalizeProductCode(entry.from)
  const toKey = normalizeProductCode(entry.to)
  if (fromKey) {
    byFrom.set(fromKey, entry)
  }
  if (toKey) {
    byTo.set(toKey, entry)
  }
}

export function normalizeProductCode(code: string): string {
  return String(code || '').trim().replace(/^[gG]+/, '').toLowerCase()
}

export function shopProductCode(code: string): string {
  const trimmed = String(code || '').trim()
  if (!trimmed) {
    return ''
  }
  return /^[gG]/.test(trimmed) ? trimmed : `g${trimmed}`
}

export function getSeasonMapActiveAt(env: EnvLike = process.env): Date {
  const raw = env.SEASON_MAP_ACTIVE_AT || DEFAULT_SEASON_MAP_ACTIVE_AT
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return new Date(DEFAULT_SEASON_MAP_ACTIVE_AT)
  }
  return parsed
}

export function isSeasonMapActive(now: Date = new Date(), env: EnvLike = process.env): boolean {
  return now.getTime() >= getSeasonMapActiveAt(env).getTime()
}

export function getSeasonMapEntries(): SeasonMapEntry[] {
  return entries
}

export function getSuccessorEntry(code: string): SeasonMapEntry | null {
  const key = normalizeProductCode(code)
  if (!key) {
    return null
  }
  return byFrom.get(key) || null
}

export function getSeasonMapEntryForCode(code: string): SeasonMapEntry | null {
  const key = normalizeProductCode(code)
  if (!key) {
    return null
  }
  return byFrom.get(key) || byTo.get(key) || null
}

export function getSeasonMapEntryForUrl(url: string): SeasonMapEntry | null {
  const match = String(url || '').match(/\/shop\/g\/([^/?#]+)/i)
  if (!match) {
    return null
  }
  return getSeasonMapEntryForCode(decodeURIComponent(match[1]))
}

export function isSupersededCode(code: string, now: Date = new Date(), env: EnvLike = process.env): boolean {
  if (!isSeasonMapActive(now, env)) {
    return false
  }
  return getSuccessorEntry(code) != null
}

export function resolveSeasonSuccessor(
  code: string,
  now: Date = new Date(),
  env: EnvLike = process.env
): SeasonMapEntry | null {
  if (!isSeasonMapActive(now, env)) {
    return null
  }
  return getSuccessorEntry(code)
}

export function supersededNormalizedCodes(now: Date = new Date(), env: EnvLike = process.env): string[] {
  if (!isSeasonMapActive(now, env)) {
    return []
  }
  return entries.map((entry) => normalizeProductCode(entry.from)).filter(Boolean)
}
