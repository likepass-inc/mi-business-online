/**
 * 管理ユーザーの永続化。画像リサイズジョブと同じ DB を使う。
 * IMAGE_RESIZE_JOBS_DATABASE_URL または DATABASE_URL が Postgres ならそちら、未設定時は SQLite。
 */

import { hashPassword, verifyPassword } from '@/lib/password'

export type AdminRole = 'admin' | 'editor'

export type AdminUser = {
  email: string
  role: AdminRole
  is_active: boolean
  created_at: string
}

export type AdminUserWithHash = AdminUser & { password_hash: string }

const SEED_EMAIL = 'nakamura@likepass.net'
const SEED_PASSWORD_HASH =
  'scrypt$16384$8$1$hXqkjNx856CTl6NhhaVBOw$UqWJWBaMV3qtHZLtZshEgBUf1gEV6nAKw1CAjC8xdVI'

export function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase()
}

export function isAdminRole(role: string): role is AdminRole {
  return role === 'admin' || role === 'editor'
}

export class AdminUserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminUserError'
  }
}

export interface AdminUserStore {
  findByEmail(email: string): Promise<AdminUserWithHash | null>
  findActiveByEmail(email: string): Promise<AdminUserWithHash | null>
  listUsers(): Promise<AdminUser[]>
  createUser(input: { email: string; password: string; role?: string }): Promise<AdminUser>
  updateUser(email: string, patch: { role?: string; is_active?: boolean }): Promise<AdminUser>
  updatePassword(email: string, password: string): Promise<AdminUser | null>
}

function publicUser(row: AdminUserWithHash | AdminUser): AdminUser {
  return {
    email: row.email,
    role: row.role,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  }
}

function seedEmail(): string {
  return normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL || SEED_EMAIL)
}

function seedPasswordHash(): string {
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD
  if (password) return hashPassword(password)
  return SEED_PASSWORD_HASH
}

function createSqliteStore(): AdminUserStore {
  const { getDatabase } = require('./schema')
  const db = getDatabase()
  let ready = false

  function ensure() {
    if (ready) return
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        email TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'editor',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    const count = db.prepare(`SELECT COUNT(*) AS n FROM admin_users`).get() as { n: number }
    if (count.n === 0) {
      db.prepare(
        `INSERT INTO admin_users (email, password_hash, role, is_active) VALUES (?, ?, 'admin', 1)`
      ).run(seedEmail(), seedPasswordHash())
      console.log('[auth] seeded admin user', seedEmail())
    }
    ready = true
  }

  function mapRow(row: {
    email: string
    password_hash: string
    role: AdminRole
    is_active: number | boolean
    created_at: string
  }): AdminUserWithHash {
    return {
      email: row.email,
      password_hash: row.password_hash,
      role: row.role,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
    }
  }

  function countActiveAdmins(exceptEmail?: string): number {
    if (exceptEmail) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS n FROM admin_users WHERE role = 'admin' AND is_active = 1 AND email != ?`
        )
        .get(exceptEmail) as { n: number }
      return row.n
    }
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM admin_users WHERE role = 'admin' AND is_active = 1`)
      .get() as { n: number }
    return row.n
  }

  return {
    async findByEmail(email) {
      ensure()
      const row = db
        .prepare(
          `SELECT email, password_hash, role, is_active, created_at FROM admin_users WHERE email = ?`
        )
        .get(normalizeEmail(email)) as
        | {
            email: string
            password_hash: string
            role: AdminRole
            is_active: number
            created_at: string
          }
        | undefined
      return row ? mapRow(row) : null
    },
    async findActiveByEmail(email) {
      const user = await this.findByEmail(email)
      return user && user.is_active ? user : null
    },
    async listUsers() {
      ensure()
      const rows = db
        .prepare(
          `SELECT email, role, is_active, created_at FROM admin_users ORDER BY created_at ASC`
        )
        .all() as Array<{
        email: string
        role: AdminRole
        is_active: number
        created_at: string
      }>
      return rows.map((row) => publicUser({ ...row, password_hash: '', is_active: Boolean(row.is_active) }))
    },
    async createUser({ email, password, role }) {
      ensure()
      const normalized = normalizeEmail(email)
      const nextRole: AdminRole = role === 'admin' ? 'admin' : 'editor'
      if (!normalized || !normalized.includes('@')) {
        throw new AdminUserError('メールアドレスを入力してください')
      }
      if (!password) {
        throw new AdminUserError('パスワードを入力してください')
      }
      const existing = db.prepare(`SELECT email FROM admin_users WHERE email = ?`).get(normalized)
      if (existing) {
        throw new AdminUserError('このメールアドレスは既に登録されています')
      }
      db.prepare(
        `INSERT INTO admin_users (email, password_hash, role, is_active) VALUES (?, ?, ?, 1)`
      ).run(normalized, hashPassword(password), nextRole)
      const row = db
        .prepare(`SELECT email, role, is_active, created_at FROM admin_users WHERE email = ?`)
        .get(normalized) as AdminUser
      return publicUser({ ...row, password_hash: '', is_active: Boolean(row.is_active) })
    },
    async updateUser(email, patch) {
      ensure()
      const normalized = normalizeEmail(email)
      const current = db
        .prepare(`SELECT email, role, is_active, created_at FROM admin_users WHERE email = ?`)
        .get(normalized) as
        | { email: string; role: AdminRole; is_active: number; created_at: string }
        | undefined
      if (!current) {
        throw new AdminUserError('ユーザーが見つかりません')
      }
      const nextRole: AdminRole =
        patch.role === 'admin' || patch.role === 'editor' ? patch.role : current.role
      const nextActive = typeof patch.is_active === 'boolean' ? patch.is_active : Boolean(current.is_active)
      if (current.role === 'admin' && current.is_active && (nextRole !== 'admin' || nextActive === false)) {
        if (countActiveAdmins(current.email) < 1) {
          throw new AdminUserError('最後の管理者は無効化・降格できません')
        }
      }
      db.prepare(`UPDATE admin_users SET role = ?, is_active = ? WHERE email = ?`).run(
        nextRole,
        nextActive ? 1 : 0,
        normalized
      )
      const row = db
        .prepare(`SELECT email, role, is_active, created_at FROM admin_users WHERE email = ?`)
        .get(normalized) as AdminUser
      return publicUser({ ...row, password_hash: '', is_active: Boolean(row.is_active) })
    },
    async updatePassword(email, password) {
      ensure()
      if (!password) {
        throw new AdminUserError('パスワードを入力してください')
      }
      const normalized = normalizeEmail(email)
      const result = db
        .prepare(`UPDATE admin_users SET password_hash = ? WHERE email = ?`)
        .run(hashPassword(password), normalized)
      if (result.changes === 0) return null
      const row = db
        .prepare(`SELECT email, role, is_active, created_at FROM admin_users WHERE email = ?`)
        .get(normalized) as AdminUser
      return publicUser({ ...row, password_hash: '', is_active: Boolean(row.is_active) })
    },
  }
}

function createPgStore(connectionUrl: string): AdminUserStore {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: connectionUrl })
  let ready: Promise<void> | null = null

  async function ensure() {
    if (!ready) {
      ready = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS admin_users (
            email TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'editor',
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `)
        const count = await pool.query(`SELECT COUNT(*)::int AS n FROM admin_users`)
        if (count.rows[0].n === 0) {
          await pool.query(
            `INSERT INTO admin_users (email, password_hash, role, is_active) VALUES ($1, $2, 'admin', true)`,
            [seedEmail(), seedPasswordHash()]
          )
          console.log('[auth] seeded admin user', seedEmail())
        }
      })()
    }
    await ready
  }

  function mapRow(row: {
    email: string
    password_hash?: string
    role: AdminRole
    is_active: boolean
    created_at: string | Date
  }): AdminUserWithHash {
    return {
      email: row.email,
      password_hash: row.password_hash || '',
      role: row.role,
      is_active: Boolean(row.is_active),
      created_at: typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString(),
    }
  }

  async function countActiveAdmins(exceptEmail?: string): Promise<number> {
    if (exceptEmail) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS n FROM admin_users WHERE role = 'admin' AND is_active = true AND email <> $1`,
        [exceptEmail]
      )
      return result.rows[0].n
    }
    const result = await pool.query(
      `SELECT COUNT(*)::int AS n FROM admin_users WHERE role = 'admin' AND is_active = true`
    )
    return result.rows[0].n
  }

  return {
    async findByEmail(email) {
      await ensure()
      const result = await pool.query(
        `SELECT email, password_hash, role, is_active, created_at FROM admin_users WHERE email = $1`,
        [normalizeEmail(email)]
      )
      return result.rows[0] ? mapRow(result.rows[0]) : null
    },
    async findActiveByEmail(email) {
      const user = await this.findByEmail(email)
      return user && user.is_active ? user : null
    },
    async listUsers() {
      await ensure()
      const result = await pool.query(
        `SELECT email, role, is_active, created_at FROM admin_users ORDER BY created_at ASC`
      )
      return result.rows.map((row: AdminUser) => publicUser(mapRow(row)))
    },
    async createUser({ email, password, role }) {
      await ensure()
      const normalized = normalizeEmail(email)
      const nextRole: AdminRole = role === 'admin' ? 'admin' : 'editor'
      if (!normalized || !normalized.includes('@')) {
        throw new AdminUserError('メールアドレスを入力してください')
      }
      if (!password) {
        throw new AdminUserError('パスワードを入力してください')
      }
      try {
        const result = await pool.query(
          `INSERT INTO admin_users (email, password_hash, role, is_active)
           VALUES ($1, $2, $3, true)
           RETURNING email, role, is_active, created_at`,
          [normalized, hashPassword(password), nextRole]
        )
        return publicUser(mapRow(result.rows[0]))
      } catch (err: any) {
        if (err && err.code === '23505') {
          throw new AdminUserError('このメールアドレスは既に登録されています')
        }
        throw err
      }
    },
    async updateUser(email, patch) {
      await ensure()
      const normalized = normalizeEmail(email)
      const current = await pool.query(
        `SELECT email, role, is_active, created_at FROM admin_users WHERE email = $1`,
        [normalized]
      )
      const row = current.rows[0]
      if (!row) {
        throw new AdminUserError('ユーザーが見つかりません')
      }
      const nextRole: AdminRole =
        patch.role === 'admin' || patch.role === 'editor' ? patch.role : row.role
      const nextActive = typeof patch.is_active === 'boolean' ? patch.is_active : Boolean(row.is_active)
      if (row.role === 'admin' && row.is_active && (nextRole !== 'admin' || nextActive === false)) {
        if ((await countActiveAdmins(row.email)) < 1) {
          throw new AdminUserError('最後の管理者は無効化・降格できません')
        }
      }
      const result = await pool.query(
        `UPDATE admin_users SET role = $2, is_active = $3 WHERE email = $1
         RETURNING email, role, is_active, created_at`,
        [normalized, nextRole, nextActive]
      )
      return publicUser(mapRow(result.rows[0]))
    },
    async updatePassword(email, password) {
      await ensure()
      if (!password) {
        throw new AdminUserError('パスワードを入力してください')
      }
      const result = await pool.query(
        `UPDATE admin_users SET password_hash = $2 WHERE email = $1
         RETURNING email, role, is_active, created_at`,
        [normalizeEmail(email), hashPassword(password)]
      )
      return result.rows[0] ? publicUser(mapRow(result.rows[0])) : null
    },
  }
}

function createStore(): AdminUserStore {
  const url = process.env.IMAGE_RESIZE_JOBS_DATABASE_URL || process.env.DATABASE_URL
  if (url && url.startsWith('postgres')) {
    return createPgStore(url)
  }
  return createSqliteStore()
}

let storeInstance: AdminUserStore | null = null

export function getAdminUserStore(): AdminUserStore {
  if (!storeInstance) {
    storeInstance = createStore()
  }
  return storeInstance
}

export async function authenticateAdmin(email: string, password: string): Promise<AdminUser | null> {
  const store = getAdminUserStore()
  const user = await store.findActiveByEmail(email)
  if (!user || !verifyPassword(password, user.password_hash)) return null
  return publicUser(user)
}
