import { NextRequest, NextResponse } from 'next/server'
import { getJobStore } from '@/lib/db/imageResizeJobStore'
import { getSessionUserId } from '@/lib/auth'
import { getDownloadPresignedUrl, isR2Configured } from '@/lib/r2'
import { markStaleImageResizeJobsAsFailed } from '@/lib/imageResizeJobProcessor'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const id = parseInt((await params).id, 10)
  if (Number.isNaN(id) || id < 1) {
    return NextResponse.json({ success: false, error: '無効なジョブ ID です' }, { status: 400 })
  }
  await markStaleImageResizeJobsAsFailed()
  const store = getJobStore()
  const row = await store.getJobById(id, userId)
  if (!row) {
    return NextResponse.json({ success: false, error: 'ジョブが見つかりません' }, { status: 404 })
  }

  let downloadUrl: string | null = null
  if (row.status === 'completed' && row.output_key) {
    try {
      downloadUrl = await getDownloadPresignedUrl(row.output_key, 3600)
    } catch (e) {
      console.error('[jobs/:id] presigned url error:', e)
    }
  }

  return NextResponse.json({
    success: true,
    jobId: row.id,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    downloadUrl: downloadUrl ?? undefined,
    processedCount: row.status === 'processing' ? (row.processed_count ?? 0) : undefined,
  })
}
