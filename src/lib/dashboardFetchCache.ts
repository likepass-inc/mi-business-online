const TTL_MS = 10 * 60 * 1000

type CacheEntry = {
  at: number
  data: unknown
}

const cache = new Map<string, CacheEntry>()

export async function cachedJsonPost(url: string, body: unknown): Promise<any> {
  const key = `${url}:${JSON.stringify(body)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.data
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`)
  }
  const data = await response.json()
  cache.set(key, { at: Date.now(), data })
  return data
}
