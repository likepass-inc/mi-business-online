import { NextRequest, NextResponse } from 'next/server'
import { resizeToTwoSizes } from '@/lib/imageResize'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') ?? formData.get('files')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'ファイルがありません。field name は file または files で送信してください。' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `許可されていない形式です: ${file.type}` },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `ファイルサイズは ${MAX_SIZE_BYTES / 1024 / 1024}MB 以下にしてください。` },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const input = Buffer.from(arrayBuffer)
    const { large, small } = await resizeToTwoSizes(input)

    const base64 = (buf: Buffer) => `data:image/jpeg;base64,${buf.toString('base64')}`
    const filename = file.name.replace(/\.[^.]+$/, '') || 'image'

    return NextResponse.json({
      success: true,
      large: base64(large),
      small: base64(small),
      filename,
      largeFilename: `${filename}.jpg`,
      smallFilename: `${filename}_s.jpg`,
    })
  } catch (e) {
    console.error('[image-resize]', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'リサイズに失敗しました。' },
      { status: 500 }
    )
  }
}
