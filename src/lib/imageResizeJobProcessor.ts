import fs from 'fs'
import path from 'path'
import os from 'os'
import { Readable } from 'stream'
import yauzl from 'yauzl'
import archiver from 'archiver'
import { getDatabase } from '@/lib/db/schema'
import { getObjectStream, getClient, getBucket, PutObjectCommand } from '@/lib/r2'
import { resizeToTwoSizes } from '@/lib/imageResize'

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)$/i
const MAX_IMAGES = 5000
/** この時間を超えて processing のままのジョブはタイムアウトとして失敗扱いにする（時間） */
const STALE_PROCESSING_HOURS = 2

/**
 * 長時間「処理中」のままのジョブを失敗に更新する。
 * デプロイ・スリープ等でプロセスが落ちた場合に、履歴で「失敗」と表示されるようにする。
 */
export function markStaleImageResizeJobsAsFailed(): void {
  const db = getDatabase()
  db.prepare(
    `UPDATE image_resize_jobs SET status = 'failed', error_message = ?
     WHERE status = 'processing' AND datetime(updated_at) < datetime('now', ?)`
  ).run(
    '処理がタイムアウトしました（サーバー再起動・デプロイの可能性があります）。再度お試しください。',
    `-${STALE_PROCESSING_HOURS} hours`
  )
}

function getBasename(entryPath: string): string {
  const name = entryPath.replace(/^.*[/\\]/, '')
  return name.replace(/\.[^.]+$/, '') || 'image'
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

/**
 * 1 件の pending ジョブを取得して処理する。処理中は status を processing に更新する。
 * 呼び出し側は fire-and-forget でよい。
 */
export async function processNextImageResizeJob(): Promise<void> {
  const db = getDatabase()
  markStaleImageResizeJobsAsFailed()
  const row = db.prepare(
    `SELECT id, object_key FROM image_resize_jobs WHERE status = 'pending' ORDER BY id ASC LIMIT 1`
  ).get() as { id: number; object_key: string } | undefined

  if (!row) return

  const jobId = row.id
  const objectKey = row.object_key
  const outputKey = `outputs/${jobId}.zip`

  db.prepare(
    `UPDATE image_resize_jobs SET status = 'processing', processed_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(jobId)

  const tempDir = os.tmpdir()
  const tempPath = path.join(tempDir, `image-resize-job-${jobId}-${Date.now()}.zip`)
  const outPath = path.join(tempDir, `image-resize-job-${jobId}-${Date.now()}-out.zip`)

  try {
    const readStream = await getObjectStream(objectKey)
    const writeStream = fs.createWriteStream(tempPath)
    await new Promise<void>((resolve, reject) => {
      readStream.pipe(writeStream)
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
      readStream.on('error', reject)
    })

    const archive = archiver('zip', { zlib: { level: 6 } })
    const outStream = fs.createWriteStream(outPath)
    archive.pipe(outStream)

    let count = 0
    const usedBasenames = new Map<string, number>()

    await new Promise<void>((resolve, reject) => {
      outStream.on('finish', () => resolve())
      outStream.on('error', reject)
      yauzl.open(tempPath, { lazyEntries: true }, (err, zipFile) => {
        if (err) {
          reject(err)
          return
        }
        if (!zipFile) {
          reject(new Error('Failed to open zip'))
          return
        }

        zipFile.readEntry()
        zipFile.on('entry', (entry) => {
          if (entry.fileName.endsWith('/') || entry.fileName.includes('__MACOSX') || entry.fileName.startsWith('.')) {
            zipFile.readEntry()
            return
          }
          const name = entry.fileName.replace(/^.*[/\\]/, '')
          if (!IMAGE_EXTENSIONS.test(name)) {
            zipFile.readEntry()
            return
          }
          if (count >= MAX_IMAGES) {
            zipFile.readEntry()
            return
          }

          zipFile.openReadStream(entry, (readErr, readStream) => {
            if (readErr || !readStream) {
              zipFile.readEntry()
              return
            }
            streamToBuffer(readStream)
              .then((buf) => resizeToTwoSizes(buf))
              .then(({ large, small }) => {
                const base = getBasename(entry.fileName)
                let n = usedBasenames.get(base) ?? 0
                usedBasenames.set(base, n + 1)
                const suffix = n === 0 ? '' : `_${n + 1}`
                const largeName = `${base}${suffix}.jpg`
                const smallName = `${base}${suffix}_s.jpg`
                archive.append(large, { name: largeName })
                archive.append(small, { name: smallName })
                count++
                if (count % 50 === 0 || count === 1) {
                  db.prepare(
                    `UPDATE image_resize_jobs SET processed_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
                  ).run(count, jobId)
                }
                zipFile.readEntry()
              })
              .catch((e) => {
                console.error('[imageResizeJob] resize error:', e)
                zipFile.readEntry()
              })
          })
        })
        zipFile.on('end', () => {
          archive.finalize()
        })
      })
    })

    const size = fs.statSync(outPath).size
    await getClient().send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: outputKey,
        Body: fs.createReadStream(outPath),
        ContentLength: size,
        ContentType: 'application/zip',
      })
    )

    if (count === 0) {
      db.prepare(
        `UPDATE image_resize_jobs SET status = 'failed', error_message = ?, image_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run('ZIP内に画像がありません', count, jobId)
    } else {
      db.prepare(
        `UPDATE image_resize_jobs SET status = 'completed', output_key = ?, image_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(outputKey, count, jobId)
    }
  } catch (e) {
    console.error('[imageResizeJob]', jobId, e)
    db.prepare(
      `UPDATE image_resize_jobs SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(e instanceof Error ? e.message : String(e), jobId)
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
    } catch (_) {}
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath)
    } catch (_) {}
  }
}
