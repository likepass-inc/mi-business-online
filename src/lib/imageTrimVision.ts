import sharp from 'sharp'
import { getOpenAIClient } from '@/lib/openaiClient'

const ANALYSIS_MAX_EDGE = 1024
const MIN_CROP_AREA_RATIO = 0.01

type CropBox = { left: number; top: number; width: number; height: number }

function parseCropJson(text: string): CropBox | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  const left = Number(o.left)
  const top = Number(o.top)
  const width = Number(o.width)
  const height = Number(o.height)
  if (![left, top, width, height].every((n) => Number.isFinite(n))) return null
  return { left: Math.floor(left), top: Math.floor(top), width: Math.floor(width), height: Math.floor(height) }
}

function clampCrop(box: CropBox, imgW: number, imgH: number): CropBox | null {
  let { left, top, width, height } = box
  if (width < 1 || height < 1) return null
  left = Math.max(0, Math.min(left, imgW - 1))
  top = Math.max(0, Math.min(top, imgH - 1))
  width = Math.min(width, imgW - left)
  height = Math.min(height, imgH - top)
  if (width < 1 || height < 1) return null
  const minArea = Math.max(100 * 100, Math.floor(imgW * imgH * MIN_CROP_AREA_RATIO))
  if (width * height < minArea) return null
  return { left, top, width, height }
}

/**
 * Vision でコンテンツ矩形を推定し extract。失敗時は Sharp trim にフォールバック。
 * rotated は既に EXIF rotate 済みのバッファ。
 */
export async function trimWithVisionOrSharpFallback(
  rotated: Buffer,
  sharpThreshold: number
): Promise<Buffer> {
  const meta = await sharp(rotated).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (w < 2 || h < 2) {
    return sharp(rotated).trim({ threshold: sharpThreshold }).toBuffer()
  }

  const scale = Math.min(1, ANALYSIS_MAX_EDGE / Math.max(w, h))
  const analysisW = Math.max(1, Math.round(w * scale))
  const analysisH = Math.max(1, Math.round(h * scale))

  let analysisBuf: Buffer
  try {
    analysisBuf = await sharp(rotated).resize(analysisW, analysisH).jpeg({ quality: 85 }).toBuffer()
  } catch {
    return sharp(rotated).trim({ threshold: sharpThreshold }).toBuffer()
  }

  const dataUrl = `data:image/jpeg;base64,${analysisBuf.toString('base64')}`

  try {
    const client = getOpenAIClient()
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'This image may have large white or template margins (especially above and below the main content). ' +
                'Return ONLY a JSON object with integer fields: left, top, width, height — the bounding box in pixels ' +
                'for the coordinate system of the PROVIDED image (top-left origin). ' +
                'The box should tightly wrap the main product/content area to keep after cropping away template margins. ' +
                'The box must stay inside the image.',
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
    })

    const text = completion.choices[0]?.message?.content?.trim() ?? ''
    const analysisBox = parseCropJson(text)
    if (!analysisBox) {
      return sharp(rotated).trim({ threshold: sharpThreshold }).toBuffer()
    }

    const sx = w / analysisW
    const sy = h / analysisH
    const fullBox: CropBox = {
      left: Math.round(analysisBox.left * sx),
      top: Math.round(analysisBox.top * sy),
      width: Math.round(analysisBox.width * sx),
      height: Math.round(analysisBox.height * sy),
    }

    const clamped = clampCrop(fullBox, w, h)
    if (!clamped) {
      return sharp(rotated).trim({ threshold: sharpThreshold }).toBuffer()
    }

    return sharp(rotated).extract(clamped).toBuffer()
  } catch (e) {
    console.warn('[imageTrimVision] vision trim failed, using sharp trim:', e)
    return sharp(rotated).trim({ threshold: sharpThreshold }).toBuffer()
  }
}
