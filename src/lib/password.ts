import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 }

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  })
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!password || !stored) return false
  const parts = String(stored).split('$')
  if (parts[0] !== 'scrypt' || parts.length !== 6) return false
  const N = parseInt(parts[1], 10)
  const r = parseInt(parts[2], 10)
  const p = parseInt(parts[3], 10)
  const salt = Buffer.from(parts[4], 'base64url')
  const expected = Buffer.from(parts[5], 'base64url')
  const hash = scryptSync(password, salt, expected.length, { N, r, p })
  return hash.length === expected.length && timingSafeEqual(hash, expected)
}
