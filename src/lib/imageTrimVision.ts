import sharp from 'sharp'
import { getOpenAIClient } from '@/lib/openaiClient'
import type { TrimBackground } from '@/lib/imageResizeTypes'
import { applyTrimSanityCheck, sharpTrimBuffer } from '@/lib/imageResizeTrim'

const ANALYSIS_MAX_EDGE = 1024
const MIN_CROP_AREA_RATIO = 0.01
/** Vision の矩形を内側に縮め、縁の商品欠けを減らす（画像短辺に対する比率） */
const VISION_BBOX_INSET_RATIO = 0.015
/** この未満の面積比の crop は異常とみなし Sharp にフォールバック */
const VISION_MIN_CROP_AREA_RATIO = 0.04
/** この超の面積比は実質トリムなしとみなし Sharp にフォールバック */
const VISION_MAX_CROP_AREA_RATIO = 0.97

export type VisionTrimOptions = {
  threshold: number
  trimBackground: TrimBackground
}

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

/** バウンディングを内側に少し縮小（商品欠け防止） */
function insetCropBox(box: CropBox, imgW: number, imgH: number): CropBox | null {
  const inset = Math.max(2, Math.round(Math.min(imgW, imgH) * VISION_BBOX_INSET_RATIO))
  const left = box.left + inset
  const top = box.top + inset
  const width = box.width - 2 * inset
  const height = box.height - 2 * inset
  return clampCrop({ left, top, width, height }, imgW, imgH)
}

async function sharpTrimFallback(
  rotated: Buffer,
  threshold: number,
  trimBackground: TrimBackground
): Promise<Buffer> {
  const trimmed = await sharpTrimBuffer(rotated, threshold, trimBackground)
  return applyTrimSanityCheck(rotated, trimmed)
}

/**
 * Vision でコンテンツ矩形を推定し extract。失敗時は Sharp trim にフォールバック。
 * rotated は既に EXIF rotate 済みのバッファ。
 */
export async function trimWithVisionOrSharpFallback(
  rotated: Buffer,
  options: VisionTrimOptions
): Promise<Buffer> {
  const { threshold, trimBackground } = options
  const meta = await sharp(rotated).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (w < 2 || h < 2) {
    return sharpTrimFallback(rotated, threshold, trimBackground)
  }

  const scale = Math.min(1, ANALYSIS_MAX_EDGE / Math.max(w, h))
  const analysisW = Math.max(1, Math.round(w * scale))
  const analysisH = Math.max(1, Math.round(h * scale))

  let analysisBuf: Buffer
  try {
    analysisBuf = await sharp(rotated).resize(analysisW, analysisH).jpeg({ quality: 85 }).toBuffer()
  } catch {
    return sharpTrimFallback(rotated, threshold, trimBackground)
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
                'The box should wrap the main product/content area (including photos, text, and logos) that must remain after cropping away template margins. ' +
                'Include a modest margin inside the content so product edges are not cut off. ' +
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
      return sharpTrimFallback(rotated, threshold, trimBackground)
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
      return sharpTrimFallback(rotated, threshold, trimBackground)
    }

    const areaRatio = (clamped.width * clamped.height) / (w * h)
    if (areaRatio < VISION_MIN_CROP_AREA_RATIO || areaRatio > VISION_MAX_CROP_AREA_RATIO) {
      console.warn('[imageTrimVision] vision crop area ratio out of range, falling back to sharp trim')
      return sharpTrimFallback(rotated, threshold, trimBackground)
    }

    const inset = insetCropBox(clamped, w, h)
    if (!inset) {
      return sharpTrimFallback(rotated, threshold, trimBackground)
    }

    const extracted = await sharp(rotated).extract(inset).toBuffer()
    return applyTrimSanityCheck(rotated, extracted)
  } catch (e) {
    console.warn('[imageTrimVision] vision trim failed, using sharp trim:', e)
    return sharpTrimFallback(rotated, threshold, trimBackground)
  }
}
