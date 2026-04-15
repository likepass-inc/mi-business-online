import { NextRequest, NextResponse } from 'next/server'
import AdmZip from 'adm-zip'
import { resizeToTwoSizes, type ImageResizeOptions } from '@/lib/imageResize'
import type { TrimMode } from '@/lib/imageResizeTypes'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)$/i
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB (single image)
const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024 // 50MB
const MAX_IMAGES_IN_ZIP = 30

function isZipFile(file: File): boolean {
  const type = file.type?.toLowerCase()
  const name = file.name?.toLowerCase() ?? ''
  return (
    type === 'application/zip' ||
    type === 'application/x-zip-compressed' ||
    name.endsWith('.zip')
  )
}

function getBasename(entryPath: string): string {
  const name = entryPath.replace(/^.*[/\\]/, '')
  return name.replace(/\.[^.]+$/, '') || 'image'
}

function parseTrimMode(raw: FormDataEntryValue | null): TrimMode {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (s === 'sharp' || s === 'vision') return s
  return 'off'
}

function parseTrimThreshold(raw: FormDataEntryValue | null): number | undefined {
  if (raw == null || raw === '') return undefined
  const n = Number(String(raw))
  if (!Number.isFinite(n) || n < 0 || n > 255) return undefined
  return Math.floor(n)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const trimMode = parseTrimMode(formData.get('trimMode'))
    const trimThreshold = parseTrimThreshold(formData.get('trimThreshold'))
    if (trimMode === 'vision' && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'AI トリミングにはサーバーに OPENAI_API_KEY が設定されている必要があります。' },
        { status: 503 }
      )
    }
    const resizeOptions: ImageResizeOptions = { trimMode, trimThreshold }

    const file = formData.get('file') ?? formData.get('files')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'ファイルがありません。field name は file または files で送信してください。' },
        { status: 400 }
      )
    }

    // ZIP flow
    if (isZipFile(file)) {
      if (file.size > MAX_ZIP_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, error: `ZIPファイルは ${MAX_ZIP_SIZE_BYTES / 1024 / 1024}MB 以下にしてください。` },
          { status: 400 }
        )
      }
      const arrayBuffer = await file.arrayBuffer()
      const zipBuffer = Buffer.from(arrayBuffer)
      const zip = new AdmZip(zipBuffer)
      const entries = zip.getEntries()

      const imageEntries = entries.filter((entry) => {
        if (entry.isDirectory) return false
        const name = (entry.entryName || '').replace(/^.*[/\\]/, '')
        if (name.startsWith('.') || entry.entryName?.includes('__MACOSX')) return false
        return IMAGE_EXTENSIONS.test(name)
      })

      if (imageEntries.length === 0) {
        return NextResponse.json(
          { success: false, error: 'ZIP内に画像がありません。' },
          { status: 400 }
        )
      }
      if (imageEntries.length > MAX_IMAGES_IN_ZIP) {
        return NextResponse.json(
          { success: false, error: `画像は${MAX_IMAGES_IN_ZIP}枚までです。${imageEntries.length}枚含まれています。` },
          { status: 400 }
        )
      }

      const outZip = new AdmZip()
      const usedBasenames = new Map<string, number>()

      for (const entry of imageEntries.slice(0, MAX_IMAGES_IN_ZIP)) {
        let data: Buffer
        try {
          data = entry.getData()
        } catch {
          continue
        }
        if (!data || data.length === 0) continue

        let large: Buffer
        let small: Buffer
        try {
          const result = await resizeToTwoSizes(data, resizeOptions)
          large = result.large
          small = result.small
        } catch {
          continue
        }

        const base = getBasename(entry.entryName || 'image')
        let count = usedBasenames.get(base) ?? 0
        usedBasenames.set(base, count + 1)
        const suffix = count === 0 ? '' : `_${count + 1}`
        const largeName = `${base}${suffix}.jpg`
        const smallName = `${base}${suffix}_s.jpg`
        outZip.addFile(largeName, large)
        outZip.addFile(smallName, small)
      }

      const resultBuffer = outZip.toBuffer()
      return new NextResponse(new Uint8Array(resultBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="resized.zip"',
          'Content-Length': String(resultBuffer.length),
        },
      })
    }

    // Single image flow
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
    const { large, small } = await resizeToTwoSizes(input, resizeOptions)

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
