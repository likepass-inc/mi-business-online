/**
 * 管理画面のセッションと操作履歴。admin_users と同じ DB を使う。
 */

export const ACTION_LABELS = {
  login: 'ログイン',
  password_change: 'パスワード変更',
  user_create: 'ユーザー追加',
  user_update: 'ユーザー更新',
  image_resize: '画像リサイズ',
} as const

export type AdminAction = keyof typeof ACTION_LABELS

export type UserActivitySummary = {
  email: string
  last_seen_at: string | null
  sessions_7d: number
  last_action: string | null
  last_action_label: string | null
}

export function actionLabel(action: string | null | undefined): string | null {
  if (!action) return null
  return ACTION_LABELS[action as AdminAction] || action
}

function isKnownAction(action: string): action is AdminAction {
  return Object.prototype.hasOwnProperty.call(ACTION_LABELS, action)
}

export interface AdminActivityStore {
  startSession(email: string): Promise<number | null>
  touchLatestSession(email: string): Promise<void>
  logAction(email: string, action: string): Promise<void>
  userSessionSummaries(): Promise<UserActivitySummary[]>
}

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase()
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  return value.toISOString()
}

function createSqliteStore(): AdminActivityStore {
  const { getDatabase } = require('./schema')
  const db = getDatabase()
  let ready = false

  function ensure() {
    if (ready) return
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        request_count INTEGER NOT NULL DEFAULT 1
      )
    `)
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_session_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        user_email TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(user_email)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_session_actions_email ON admin_session_actions(user_email)`)
    ready = true
  }

  return {
    async startSession(email) {
      ensure()
      const normalized = normalizeEmail(email)
      if (!normalized) return null
      const result = db
        .prepare(`INSERT INTO admin_sessions (user_email) VALUES (?)`)
        .run(normalized)
      return Number(result.lastInsertRowid)
    },
    async touchLatestSession(email) {
      ensure()
      const normalized = normalizeEmail(email)
      if (!normalized) return
      const row = db
        .prepare(`SELECT id FROM admin_sessions WHERE user_email = ? ORDER BY last_seen_at DESC LIMIT 1`)
        .get(normalized) as { id: number } | undefined
      if (!row) {
        await this.startSession(normalized)
        return
      }
      db.prepare(
        `UPDATE admin_sessions SET last_seen_at = CURRENT_TIMESTAMP, request_count = request_count + 1 WHERE id = ?`
      ).run(row.id)
    },
    async logAction(email, action) {
      ensure()
      const normalized = normalizeEmail(email)
      if (!normalized || !isKnownAction(action)) return
      const row = db
        .prepare(`SELECT id FROM admin_sessions WHERE user_email = ? ORDER BY last_seen_at DESC LIMIT 1`)
        .get(normalized) as { id: number } | undefined
      const sessionId = row?.id ?? (await this.startSession(normalized))
      db.prepare(`INSERT INTO admin_session_actions (session_id, user_email, action) VALUES (?, ?, ?)`).run(
        sessionId,
        normalized,
        action
      )
    },
    async userSessionSummaries() {
      ensure()
      const rows = db
        .prepare(
          `SELECT
             u.email,
             (
               SELECT s.last_seen_at FROM admin_sessions s
               WHERE s.user_email = u.email
               ORDER BY s.last_seen_at DESC LIMIT 1
             ) AS last_seen_at,
             (
               SELECT COUNT(*) FROM admin_sessions s2
               WHERE s2.user_email = u.email
                 AND datetime(s2.started_at) > datetime('now', '-7 days')
             ) AS sessions_7d,
             (
               SELECT a.action FROM admin_session_actions a
               WHERE a.user_email = u.email
               ORDER BY a.created_at DESC LIMIT 1
             ) AS last_action
           FROM admin_users u`
        )
        .all() as Array<{
        email: string
        last_seen_at: string | null
        sessions_7d: number
        last_action: string | null
      }>
      return rows.map((row) => ({
        email: row.email,
        last_seen_at: row.last_seen_at || null,
        sessions_7d: Number(row.sessions_7d) || 0,
        last_action: row.last_action || null,
        last_action_label: actionLabel(row.last_action),
      }))
    },
  }
}

function createPgStore(connectionUrl: string): AdminActivityStore {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: connectionUrl })
  let ready: Promise<void> | null = null

  async function ensure() {
    if (!ready) {
      ready = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS admin_sessions (
            id SERIAL PRIMARY KEY,
            user_email TEXT NOT NULL,
            started_at TIMESTAMPTZ DEFAULT NOW(),
            last_seen_at TIMESTAMPTZ DEFAULT NOW(),
            request_count INTEGER NOT NULL DEFAULT 1
          )
        `)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS admin_session_actions (
            id SERIAL PRIMARY KEY,
            session_id INTEGER,
            user_email TEXT NOT NULL,
            action TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `)
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(user_email)`)
        await pool.query(
          `CREATE INDEX IF NOT EXISTS idx_admin_session_actions_email ON admin_session_actions(user_email)`
        )
      })()
    }
    await ready
  }

  return {
    async startSession(email) {
      await ensure()
      const normalized = normalizeEmail(email)
      if (!normalized) return null
      const result = await pool.query(
        `INSERT INTO admin_sessions (user_email) VALUES ($1) RETURNING id`,
        [normalized]
      )
      return result.rows[0]?.id ?? null
    },
    async touchLatestSession(email) {
      await ensure()
      const normalized = normalizeEmail(email)
      if (!normalized) return
      const current = await pool.query(
        `SELECT id FROM admin_sessions WHERE user_email = $1 ORDER BY last_seen_at DESC LIMIT 1`,
        [normalized]
      )
      if (!current.rows[0]) {
        await this.startSession(normalized)
        return
      }
      await pool.query(
        `UPDATE admin_sessions SET last_seen_at = NOW(), request_count = request_count + 1 WHERE id = $1`,
        [current.rows[0].id]
      )
    },
    async logAction(email, action) {
      await ensure()
      const normalized = normalizeEmail(email)
      if (!normalized || !isKnownAction(action)) return
      const current = await pool.query(
        `SELECT id FROM admin_sessions WHERE user_email = $1 ORDER BY last_seen_at DESC LIMIT 1`,
        [normalized]
      )
      const sessionId = current.rows[0]?.id ?? (await this.startSession(normalized))
      await pool.query(
        `INSERT INTO admin_session_actions (session_id, user_email, action) VALUES ($1, $2, $3)`,
        [sessionId, normalized, action]
      )
    },
    async userSessionSummaries() {
      await ensure()
      const result = await pool.query(
        `SELECT
           u.email,
           s.last_seen_at,
           a.action AS last_action,
           COALESCE((
             SELECT COUNT(*)::int
             FROM admin_sessions s2
             WHERE s2.user_email = u.email AND s2.started_at > NOW() - INTERVAL '7 days'
           ), 0) AS sessions_7d
         FROM admin_users u
         LEFT JOIN LATERAL (
           SELECT last_seen_at
           FROM admin_sessions
           WHERE user_email = u.email
           ORDER BY last_seen_at DESC
           LIMIT 1
         ) s ON true
         LEFT JOIN LATERAL (
           SELECT action
           FROM admin_session_actions
           WHERE user_email = u.email
           ORDER BY created_at DESC
           LIMIT 1
         ) a ON true`
      )
      return result.rows.map((row: { email: string; last_seen_at: string | Date | null; sessions_7d: number; last_action: string | null }) => ({
        email: row.email,
        last_seen_at: toIso(row.last_seen_at),
        sessions_7d: Number(row.sessions_7d) || 0,
        last_action: row.last_action || null,
        last_action_label: actionLabel(row.last_action),
      }))
    },
  }
}

function createStore(): AdminActivityStore {
  const url = process.env.IMAGE_RESIZE_JOBS_DATABASE_URL || process.env.DATABASE_URL
  if (url && url.startsWith('postgres')) {
    return createPgStore(url)
  }
  return createSqliteStore()
}

let storeInstance: AdminActivityStore | null = null

export function getAdminActivityStore(): AdminActivityStore {
  if (!storeInstance) {
    storeInstance = createStore()
  }
  return storeInstance
}

export async function recordAdminAction(email: string, action: AdminAction): Promise<void> {
  try {
    await getAdminActivityStore().logAction(email, action)
  } catch (err) {
    console.warn('[admin-activity] log', err instanceof Error ? err.message : err)
  }
}

export async function recordAdminSessionStart(email: string): Promise<void> {
  try {
    await getAdminActivityStore().startSession(email)
    await getAdminActivityStore().logAction(email, 'login')
  } catch (err) {
    console.warn('[admin-activity] start', err instanceof Error ? err.message : err)
  }
}

export async function touchAdminSession(email: string): Promise<void> {
  try {
    await getAdminActivityStore().touchLatestSession(email)
  } catch (err) {
    console.warn('[admin-activity] touch', err instanceof Error ? err.message : err)
  }
}
