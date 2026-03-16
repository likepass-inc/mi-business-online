/**
 * 画像リサイズジョブの永続化レイヤー。
 * IMAGE_RESIZE_JOBS_DATABASE_URL が設定されていれば PostgreSQL、未設定なら SQLite を使用。
 * いずれも async API で統一。
 */

export type JobRow = {
  id: number
  object_key: string
  status: string
  output_key: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  user_id: string | null
  input_size_bytes: number | null
  image_count: number | null
  processed_count: number | null
}

export type PendingJobRow = { id: number; object_key: string }

export interface ImageResizeJobStore {
  getNextPendingJob(): Promise<PendingJobRow | null>
  markStaleAsFailed(): Promise<void>
  insertJob(objectKey: string, userId: string | null, inputSizeBytes: number | null): Promise<number>
  updateToProcessing(jobId: number): Promise<void>
  setProcessedCount(jobId: number, count: number): Promise<void>
  completeJob(jobId: number, outputKey: string, imageCount: number): Promise<void>
  failJob(jobId: number, errorMessage: string, imageCount?: number): Promise<void>
  getJobById(
    jobId: number,
    userId: string | null
  ): Promise<(Pick<JobRow, 'id' | 'status' | 'output_key' | 'error_message' | 'processed_count'>) | null>
  listJobsByUserId(
    userId: string
  ): Promise<
    Array<
      Pick<
        JobRow,
        'id' | 'status' | 'created_at' | 'input_size_bytes' | 'image_count' | 'error_message' | 'processed_count'
      >
    >
  >
}

const STALE_HOURS = 2
const STALE_ERROR =
  '処理がタイムアウトしました（サーバー再起動・デプロイの可能性があります）。再度お試しください。'

function getStore(): ImageResizeJobStore {
  const url = process.env.IMAGE_RESIZE_JOBS_DATABASE_URL || process.env.DATABASE_URL
  if (url && url.startsWith('postgres')) {
    return createPgStore(url)
  }
  return createSqliteStore()
}

function createSqliteStore(): ImageResizeJobStore {
  const { getDatabase } = require('./schema')
  const db = getDatabase()

  return {
    async getNextPendingJob() {
      const row = db
        .prepare(
          `SELECT id, object_key FROM image_resize_jobs WHERE status = 'pending' ORDER BY id ASC LIMIT 1`
        )
        .get() as PendingJobRow | undefined
      return row ?? null
    },
    async markStaleAsFailed() {
      db.prepare(
        `UPDATE image_resize_jobs SET status = 'failed', error_message = ?
         WHERE status = 'processing' AND datetime(updated_at) < datetime('now', ?)`
      ).run(STALE_ERROR, `-${STALE_HOURS} hours`)
    },
    async insertJob(objectKey, userId, inputSizeBytes) {
      const result = db
        .prepare(
          `INSERT INTO image_resize_jobs (object_key, status, user_id, input_size_bytes) VALUES (?, 'pending', ?, ?)`
        )
        .run(objectKey, userId, inputSizeBytes)
      return Number(result.lastInsertRowid)
    },
    async updateToProcessing(jobId) {
      db.prepare(
        `UPDATE image_resize_jobs SET status = 'processing', processed_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(jobId)
    },
    async setProcessedCount(jobId, count) {
      db.prepare(
        `UPDATE image_resize_jobs SET processed_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(count, jobId)
    },
    async completeJob(jobId, outputKey, imageCount) {
      db.prepare(
        `UPDATE image_resize_jobs SET status = 'completed', output_key = ?, image_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(outputKey, imageCount, jobId)
    },
    async failJob(jobId, errorMessage, imageCount?) {
      if (imageCount !== undefined) {
        db.prepare(
          `UPDATE image_resize_jobs SET status = 'failed', error_message = ?, image_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(errorMessage, imageCount, jobId)
      } else {
        db.prepare(
          `UPDATE image_resize_jobs SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(errorMessage, jobId)
      }
    },
    async getJobById(jobId, userId) {
      const row = db
        .prepare(
          `SELECT id, status, output_key, error_message, processed_count FROM image_resize_jobs
           WHERE id = ? AND (user_id = ? OR user_id IS NULL)`
        )
        .get(jobId, userId) as
        | { id: number; status: string; output_key: string | null; error_message: string | null; processed_count: number | null }
        | undefined
      return row ?? null
    },
    async listJobsByUserId(userId) {
      const rows = db
        .prepare(
          `SELECT id, status, created_at, input_size_bytes, image_count, error_message, processed_count
           FROM image_resize_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
        )
        .all(userId) as Array<{
        id: number
        status: string
        created_at: string
        input_size_bytes: number | null
        image_count: number | null
        error_message: string | null
        processed_count: number | null
      }>
      return rows
    },
  }
}

function createPgStore(connectionUrl: string): ImageResizeJobStore {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: connectionUrl })

  async function ensureTable() {
    const client = await pool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS image_resize_jobs (
          id SERIAL PRIMARY KEY,
          object_key TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          output_key TEXT,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          user_id TEXT,
          input_size_bytes BIGINT,
          image_count INTEGER,
          processed_count INTEGER
        )
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_image_resize_jobs_status ON image_resize_jobs(status)
      `)
    } finally {
      client.release()
    }
  }

  let ensured = false
  async function ensure() {
    if (!ensured) {
      await ensureTable()
      ensured = true
    }
  }

  return {
    async getNextPendingJob() {
      await ensure()
      const res = await pool.query(
        `SELECT id, object_key FROM image_resize_jobs WHERE status = 'pending' ORDER BY id ASC LIMIT 1`
      )
      const row = res.rows[0]
      return row ? { id: row.id, object_key: row.object_key } : null
    },
    async markStaleAsFailed() {
      await ensure()
      await pool.query(
        `UPDATE image_resize_jobs SET status = 'failed', error_message = $1, updated_at = NOW()
         WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '${STALE_HOURS} hours'`,
        [STALE_ERROR]
      )
    },
    async insertJob(objectKey: string, userId: string | null, inputSizeBytes: number | null) {
      await ensure()
      const res = await pool.query(
        `INSERT INTO image_resize_jobs (object_key, status, user_id, input_size_bytes)
         VALUES ($1, 'pending', $2, $3) RETURNING id`,
        [objectKey, userId, inputSizeBytes]
      )
      return res.rows[0].id
    },
    async updateToProcessing(jobId: number) {
      await ensure()
      await pool.query(
        `UPDATE image_resize_jobs SET status = 'processing', processed_count = 0, updated_at = NOW() WHERE id = $1`,
        [jobId]
      )
    },
    async setProcessedCount(jobId: number, count: number) {
      await ensure()
      await pool.query(
        `UPDATE image_resize_jobs SET processed_count = $1, updated_at = NOW() WHERE id = $2`,
        [count, jobId]
      )
    },
    async completeJob(jobId: number, outputKey: string, imageCount: number) {
      await ensure()
      await pool.query(
        `UPDATE image_resize_jobs SET status = 'completed', output_key = $1, image_count = $2, updated_at = NOW() WHERE id = $3`,
        [outputKey, imageCount, jobId]
      )
    },
    async failJob(jobId: number, errorMessage: string, imageCount?: number) {
      await ensure()
      if (imageCount !== undefined) {
        await pool.query(
          `UPDATE image_resize_jobs SET status = 'failed', error_message = $1, image_count = $2, updated_at = NOW() WHERE id = $3`,
          [errorMessage, imageCount, jobId]
        )
      } else {
        await pool.query(
          `UPDATE image_resize_jobs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
          [errorMessage, jobId]
        )
      }
    },
    async getJobById(jobId: number, userId: string | null) {
      await ensure()
      const res = await pool.query(
        `SELECT id, status, output_key, error_message, processed_count
         FROM image_resize_jobs WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
        [jobId, userId]
      )
      const row = res.rows[0]
      return row ?? null
    },
    async listJobsByUserId(userId: string) {
      await ensure()
      const res = await pool.query(
        `SELECT id, status, created_at, input_size_bytes, image_count, error_message, processed_count
         FROM image_resize_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [userId]
      )
      return res.rows
    },
  }
}

let storeInstance: ImageResizeJobStore | null = null

export function getJobStore(): ImageResizeJobStore {
  if (!storeInstance) {
    storeInstance = getStore()
  }
  return storeInstance
}
