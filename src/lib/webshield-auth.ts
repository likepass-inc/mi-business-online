/**
 * WebShield auth-gate client (server-only).
 * Hashes client IP with site secret; never sends usernames or passwords.
 */

type GateAction = 'check' | 'failed' | 'success'

export type GateResult = {
  allow: boolean
  remaining: number
  lockedUntil: string | null
  skipped?: boolean
  failOpen?: boolean
  error?: string
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(text: string): Promise<string> {
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return toHex(dig)
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toHex(sig)
}

export async function hashClientIp(ip: string, secret: string): Promise<string> {
  const clean = String(ip || '').split(',')[0].trim() || 'unknown'
  return sha256Hex(`${secret}|${clean}`)
}

export function webshieldConfigured(): boolean {
  return Boolean(
    process.env.WEBSHIELD_ENDPOINT &&
      process.env.WEBSHIELD_SITE &&
      process.env.WEBSHIELD_SECRET
  )
}

export async function webshieldGate(opts: {
  action: GateAction
  path?: string
  ip: string
}): Promise<GateResult> {
  const endpoint = String(process.env.WEBSHIELD_ENDPOINT || '').replace(/\/$/, '')
  const siteId = process.env.WEBSHIELD_SITE || ''
  const secret = process.env.WEBSHIELD_SECRET || ''
  if (!endpoint || !siteId || !secret) {
    return { allow: true, remaining: 0, lockedUntil: null, skipped: true, error: 'not_configured' }
  }

  const clientKey = await hashClientIp(opts.ip, secret)
  const bodyObj = {
    action: opts.action,
    clientKey,
    path: opts.path || '/api/auth/login',
    ts: Math.floor(Date.now() / 1000),
    nonce: crypto.randomUUID(),
  }
  const body = JSON.stringify(bodyObj)
  const signature = await hmacSha256Hex(secret, body)

  try {
    const res = await fetch(`${endpoint}/v1/auth/gate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webshield-site': siteId,
        'x-webshield-signature': signature,
      },
      body,
    })
    const json = (await res.json().catch(() => null)) as {
      allow?: boolean
      remaining?: number
      lockedUntil?: string | null
      error?: string
    } | null
    if (!res.ok) {
      return {
        allow: true,
        remaining: 0,
        lockedUntil: null,
        failOpen: true,
        error: (json && json.error) || `http_${res.status}`,
      }
    }
    return {
      allow: !!json?.allow,
      remaining: Number(json?.remaining) || 0,
      lockedUntil: json?.lockedUntil || null,
    }
  } catch (e) {
    return {
      allow: true,
      remaining: 0,
      lockedUntil: null,
      failOpen: true,
      error: e instanceof Error ? e.message : 'fetch_failed',
    }
  }
}
