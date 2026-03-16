import { NextResponse } from 'next/server'
import { getJobStore } from '@/lib/db/imageResizeJobStore'
import { getSessionUserId } from '@/lib/auth'
import { isR2Configured } from '@/lib/r2'

const CANCEL_MESSAGE = 'ユーザーにより中止'

export async function POST(
  _req: Request,
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
  try {
    const store = getJobStore()
    const row = await store.getJobById(id, userId)
    if (!row) {
      return NextResponse.json({ success: false, error: 'ジョブが見つかりません' }, { status: 404 })
    }
    if (row.status !== 'pending' && row.status !== 'processing') {
      return NextResponse.json(
        { success: false, error: 'このジョブは中止できません（完了または失敗済みです）' },
        { status: 400 }
      )
    }
    await store.failJob(id, CANCEL_MESSAGE)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[image-resize jobs] cancel error:', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : '中止に失敗しました' },
      { status: 500 }
    )
  }
}
