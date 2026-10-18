/**
 * Cloudflare Turnstile server-side verification.
 * Opt-in: only enforced when TURNSTILE_SECRET_KEY is set.
 */

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export function turnstileRequired(): boolean {
  return turnstileConfigured() && process.env.NODE_ENV === 'production'
}

export async function verifyTurnstileToken(
  token: unknown,
  remoteip?: string
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    return { ok: true }
  }

  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, error: 'missing_token' }
  }

  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token.trim())
  if (remoteip && remoteip !== 'unknown') {
    body.set('remoteip', remoteip)
  }

  try {
    const res = await fetch(SITEVERIFY, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (!data.success) {
      return { ok: false, error: (data['error-codes'] || ['verify_failed']).join(',') }
    }
    return { ok: true }
  } catch {
    if (turnstileRequired()) {
      return { ok: false, error: 'verify_unavailable' }
    }
    return { ok: true }
  }
}
