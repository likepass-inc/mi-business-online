import type { SiteSearchEffectSnapshot } from '@/lib/monthlyChartsTypes'

const DEFAULT_BASE = 'https://ai-chatbot-mi-business.onrender.com'

function getConfig(): { baseUrl: string; email: string; password: string } | null {
  const email = process.env.SITE_SEARCH_EFFECT_BASIC_USER?.trim()
  const password = process.env.SITE_SEARCH_EFFECT_BASIC_PASSWORD
  if (!email || password == null || String(password) === '') return null
  const baseUrl = (
    process.env.SITE_SEARCH_EFFECT_BASE_URL?.trim() || DEFAULT_BASE
  ).replace(/\/$/, '')
  return { baseUrl, email, password: String(password) }
}

function normalizeSnapshot(raw: Record<string, unknown>): SiteSearchEffectSnapshot {
  const topQueries = Array.isArray(raw.topQueries)
    ? (raw.topQueries as SiteSearchEffectSnapshot['topQueries'])
    : []
  const zeroHitQueries = Array.isArray(raw.zeroHitQueries)
    ? (raw.zeroHitQueries as SiteSearchEffectSnapshot['zeroHitQueries'])
    : []

  return {
    startYmd: String(raw.startYmd || ''),
    endYmd: String(raw.endYmd || ''),
    label: String(raw.label || ''),
    totalSearches: Number(raw.totalSearches) || 0,
    uniqueQueries: Number(raw.uniqueQueries) || 0,
    avgKnowledge: Number(raw.avgKnowledge) || 0,
    avgProducts: Number(raw.avgProducts) || 0,
    topQueries,
    zeroHitQueries,
    ga4: (raw.ga4 as SiteSearchEffectSnapshot['ga4']) ?? null,
  }
}

async function loginForBearerToken(
  baseUrl: string,
  email: string,
  password: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/admin/site-search-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `site-search login failed: HTTP ${res.status}${text ? ` ${text.slice(0, 200)}` : ''}`
    )
  }
  const json = (await res.json()) as {
    success?: boolean
    token?: string
    message?: string
  }
  if (!json.success || !json.token) {
    throw new Error(json.message || 'site-search login returned no token')
  }
  return json.token
}

export async function fetchSiteSearchEffectForRange(
  startYmd: string,
  endYmd: string,
  bearerToken?: string
): Promise<SiteSearchEffectSnapshot> {
  const config = getConfig()
  if (!config) {
    throw new Error(
      'SITE_SEARCH_EFFECT_BASIC_USER / SITE_SEARCH_EFFECT_BASIC_PASSWORD are not set'
    )
  }

  const token =
    bearerToken || (await loginForBearerToken(config.baseUrl, config.email, config.password))

  const qs = new URLSearchParams({
    period: 'custom',
    start: startYmd,
    end: endYmd,
  })
  const url = `${config.baseUrl}/api/admin/site-search-effect-report?${qs}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `site-search-effect-report failed: HTTP ${res.status}${text ? ` ${text.slice(0, 200)}` : ''}`
    )
  }

  const json = (await res.json()) as {
    success?: boolean
    error?: string
    data?: Record<string, unknown>
  }
  if (!json.success || !json.data) {
    throw new Error(json.error || 'site-search-effect-report returned no data')
  }
  return normalizeSnapshot(json.data)
}

export function isSiteSearchEffectConfigured(): boolean {
  return getConfig() !== null
}

export async function fetchSiteSearchEffectYoY(options: {
  monthStart: string
  monthEnd: string
  yoyMonthStart: string
  yoyMonthEnd: string
}): Promise<{ current: SiteSearchEffectSnapshot; yearAgo: SiteSearchEffectSnapshot } | null> {
  const config = getConfig()
  if (!config) return null

  const token = await loginForBearerToken(config.baseUrl, config.email, config.password)
  const [current, yearAgo] = await Promise.all([
    fetchSiteSearchEffectForRange(options.monthStart, options.monthEnd, token),
    fetchSiteSearchEffectForRange(options.yoyMonthStart, options.yoyMonthEnd, token),
  ])
  return { current, yearAgo }
}
