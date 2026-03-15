/**
 * 画像リサイズ専用 Background Worker。
 * 一定間隔で processNextImageResizeJob を実行する。
 * Render の Background Worker では Start Command に npm run worker を指定する。
 *
 * 必要環境変数:
 * - IMAGE_RESIZE_JOBS_DATABASE_URL または DATABASE_URL (PostgreSQL)
 * - R2 用の環境変数（Web サービスと同様）
 */

import { processNextImageResizeJob } from '../src/lib/imageResizeJobProcessor'

const POLL_INTERVAL_MS = 30_000 // 30秒

async function main() {
  const url = process.env.IMAGE_RESIZE_JOBS_DATABASE_URL || process.env.DATABASE_URL
  if (!url || !url.startsWith('postgres')) {
    console.error('[image-resize-worker] IMAGE_RESIZE_JOBS_DATABASE_URL (PostgreSQL) が未設定です。終了します。')
    process.exit(1)
  }
  console.log('[image-resize-worker] Started. Polling every', POLL_INTERVAL_MS / 1000, 'seconds.')
  while (true) {
    try {
      await processNextImageResizeJob()
    } catch (e) {
      console.error('[image-resize-worker]', e)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch((e) => {
  console.error('[image-resize-worker] Fatal:', e)
  process.exit(1)
})
