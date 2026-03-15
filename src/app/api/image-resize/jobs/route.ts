import { NextRequest, NextResponse } from 'next/server'
import { getJobStore } from '@/lib/db/imageResizeJobStore'
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
  try {
    const store = getJobStore()
    const jobId = await store.insertJob(objectKey, userId, inputSizeBytes)
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
  } catch (e) {
    console.error('[image-resize jobs] POST error:', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'ジョブの登録に失敗しました' },
      { status: 500 }
    )
  }
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
  try {
    const store = getJobStore()
    await store.markStaleAsFailed()
    const rows = await store.listJobsByUserId(userId)
    const jobs = rows.map((r) => ({
    jobId: r.id,
    status: r.status,
    createdAt: r.created_at,
    imageCount: r.image_count ?? undefined,
    inputSizeBytes: r.input_size_bytes ?? undefined,
    errorMessage: r.error_message ?? undefined,
  }))
    return NextResponse.json({ success: true, jobs })
  } catch (e) {
    console.error('[image-resize jobs] GET list error:', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : '履歴の取得に失敗しました', jobs: [] },
      { status: 500 }
    )
  }
}
