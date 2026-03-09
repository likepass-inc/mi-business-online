import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/schema'
import { getSessionUserId } from '@/lib/auth'
import { isR2Configured } from '@/lib/r2'
import { processNextImageResizeJob } from '@/lib/imageResizeJobProcessor'

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }
  if (!isR2Configured()) {
    return NextResponse.json(
      { success: false, error: '大容量バッチは現在利用できません（R2 未設定）' },
      { status: 503 }
    )
  }
  let body: { objectKey?: string; inputSizeBytes?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'JSON で objectKey を送信してください' },
      { status: 400 }
    )
  }
  const objectKey = body.objectKey?.trim()
  if (!objectKey) {
    return NextResponse.json(
      { success: false, error: 'objectKey は必須です' },
      { status: 400 }
    )
  }
  const inputSizeBytes =
    typeof body.inputSizeBytes === 'number' && body.inputSizeBytes >= 0 ? body.inputSizeBytes : null
  const db = getDatabase()
  const result = db
    .prepare(
      `INSERT INTO image_resize_jobs (object_key, status, user_id, input_size_bytes) VALUES (?, 'pending', ?, ?)`
    )
    .run(objectKey, userId, inputSizeBytes)
  const jobId = Number(result.lastInsertRowid)
  if (!jobId) {
    return NextResponse.json(
      { success: false, error: 'ジョブの登録に失敗しました' },
      { status: 500 }
    )
  }

  processNextImageResizeJob().catch((e) => {
    console.error('[image-resize jobs] background process error:', e)
  })

  return NextResponse.json({ success: true, jobId })
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }
  if (!isR2Configured()) {
    return NextResponse.json(
      { success: false, error: '大容量バッチは現在利用できません（R2 未設定）' },
      { status: 503 }
    )
  }
  const db = getDatabase()
  const rows = db.prepare(
    `SELECT id, status, created_at, input_size_bytes, image_count, error_message
     FROM image_resize_jobs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`
  ).all(userId) as Array<{
    id: number
    status: string
    created_at: string
    input_size_bytes: number | null
    image_count: number | null
    error_message: string | null
  }>
  const jobs = rows.map((r) => ({
    jobId: r.id,
    status: r.status,
    createdAt: r.created_at,
    imageCount: r.image_count ?? undefined,
    inputSizeBytes: r.input_size_bytes ?? undefined,
    errorMessage: r.error_message ?? undefined,
  }))
  return NextResponse.json({ success: true, jobs })
}
