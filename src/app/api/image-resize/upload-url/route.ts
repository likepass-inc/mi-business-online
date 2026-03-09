import { NextRequest, NextResponse } from 'next/server'
import { getUploadPresignedUrl, isR2Configured } from '@/lib/r2'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { success: false, error: '大容量バッチは現在利用できません（R2 未設定）' },
      { status: 503 }
    )
  }
  const filename = req.nextUrl.searchParams.get('filename') || 'upload.zip'
  const ext = filename.toLowerCase().endsWith('.zip') ? '' : '.zip'
  const objectKey = `uploads/${randomUUID()}${ext}`
  try {
    const uploadUrl = await getUploadPresignedUrl(objectKey)
    return NextResponse.json({ success: true, uploadUrl, objectKey })
  } catch (e) {
    console.error('[upload-url]', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'URL の発行に失敗しました' },
      { status: 500 }
    )
  }
}
