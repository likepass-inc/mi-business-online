import sharp from 'sharp'

/** 未設定時の Sharp trim しきい値（高すぎると商品まで欠ける） */
export const DEFAULT_TRIM_THRESHOLD = 10

export function getDefaultTrimThreshold(): number {
  const n = Number(process.env.IMAGE_TRIM_THRESHOLD)
  return Number.isFinite(n) && n >= 0 && n <= 255 ? Math.floor(n) : DEFAULT_TRIM_THRESHOLD
}

/** トリム後の幅・高さが元のこれ未満なら異常とみなしトリムを棄却 */
export function getMinResultDimensionRatio(): number {
  const n = Number(process.env.IMAGE_TRIM_MIN_RESULT_RATIO)
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.2
}

/** トリム後の面積が元のこれ未満なら棄却 */
export function getMinAreaRatio(): number {
  const n = Number(process.env.IMAGE_TRIM_MIN_AREA_RATIO)
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.12
}

/**
 * Sharp trim の結果が極端に小さい場合は元画像に戻す（過剰トリムの緩和）。
 */
export async function applyTrimSanityCheck(rotated: Buffer, trimmed: Buffer): Promise<Buffer> {
  const m0 = await sharp(rotated).metadata()
  const m1 = await sharp(trimmed).metadata()
  const w0 = m0.width ?? 0
  const h0 = m0.height ?? 0
  const w1 = m1.width ?? 0
  const h1 = m1.height ?? 0
  if (w0 < 1 || h0 < 1 || w1 < 1 || h1 < 1) {
    return trimmed
  }
  const minDim = getMinResultDimensionRatio()
  if (w1 < w0 * minDim || h1 < h0 * minDim) {
    console.warn('[imageResizeTrim] trim sanity: result dimensions too small, reverting trim')
    return rotated
  }
  const minArea = getMinAreaRatio()
  if (w1 * h1 < w0 * h0 * minArea) {
    console.warn('[imageResizeTrim] trim sanity: result area too small, reverting trim')
    return rotated
  }
  return trimmed
}

export type SharpTrimBackgroundMode = 'auto' | 'white'

export async function sharpTrimBuffer(
  rotated: Buffer,
  threshold: number,
  backgroundMode: SharpTrimBackgroundMode
): Promise<Buffer> {
  const opts: sharp.TrimOptions = { threshold }
  if (backgroundMode === 'white') {
    opts.background = '#ffffff'
  }
  return sharp(rotated).trim(opts).toBuffer()
}
