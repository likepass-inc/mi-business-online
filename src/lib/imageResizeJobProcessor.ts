import fs from 'fs'
import path from 'path'
import os from 'os'
import { Readable } from 'stream'
import yauzl from 'yauzl'
import archiver from 'archiver'
import { getJobStore } from '@/lib/db/imageResizeJobStore'
import { getObjectStream, getClient, getBucket, PutObjectCommand } from '@/lib/r2'
import { resizeToSize } from '@/lib/imageResize'

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)$/i
const MAX_IMAGES = 5000

/**
 * 長時間「処理中」のままのジョブを整理する。
 * - 2時間以上更新なし → failed（タイムアウト失敗）
 * - 5分以上2時間未満更新なし: リトライ回数が上限未満なら pending に戻して再試行、上限に達していれば failed
 *   （IMAGE_RESIZE_STALE_RETRY_MINUTES / IMAGE_RESIZE_MAX_REQUEUE_COUNT で変更可）
 * デプロイ等で Worker が落ちた場合の取り残しを防ぎつつ、無限リトライを避ける。
 */
export async function markStaleImageResizeJobsAsFailed(): Promise<void> {
  const store = getJobStore()
  await store.markStaleAsFailed()
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
  const store = getJobStore()
  await store.markStaleAsFailed()
  const row = await store.getNextPendingJob()
  if (!row) return

  const jobId = row.id
  const objectKey = row.object_key
  const outputSize = row.output_size === 'small' ? 'small' : 'large'
  const outputKey = `outputs/${jobId}.zip`

  await store.updateToProcessing(jobId)

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
    let cancelled = false
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
          if (cancelled) {
            zipFile.close()
            archive.finalize()
            return
          }
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
              .then((buf) => resizeToSize(buf, outputSize))
              .then((buffer) => {
                if (cancelled) {
                  zipFile.readEntry()
                  return
                }
                const base = getBasename(entry.fileName)
                let n = usedBasenames.get(base) ?? 0
                usedBasenames.set(base, n + 1)
                const suffix = n === 0 ? '' : `_${n + 1}`
                const fileName = outputSize === 'large' ? `${base}${suffix}.jpg` : `${base}${suffix}_s.jpg`
                archive.append(buffer, { name: fileName })
                count++
                if (count % 50 === 0 || count === 1) {
                  store.getJobStatus(jobId).then((row) => {
                    if (row?.status === 'failed') cancelled = true
                  })
                  store.setProcessedCount(jobId, count).catch((e) =>
                    console.error('[imageResizeJob] setProcessedCount error:', e)
                  )
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

    if (cancelled) {
      return
    }

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
      await store.failJob(jobId, 'ZIP内に画像がありません', count)
    } else {
      await store.completeJob(jobId, outputKey, count)
    }
  } catch (e) {
    console.error('[imageResizeJob]', jobId, e)
    await store.failJob(jobId, e instanceof Error ? e.message : String(e))
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
    } catch (_) {}
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath)
    } catch (_) {}
  }
}
