import sharp from 'sharp'
import { TARGET_SIZES, PADDING_COLOR } from './imageResizeConfig'
import { trimWithVisionOrSharpFallback } from './imageTrimVision'
import type { TrimBackground, TrimMode } from './imageResizeTypes'
import {
  applyTrimSanityCheck,
  getDefaultTrimThreshold,
  sharpTrimBuffer,
} from './imageResizeTrim'

export type { TrimMode } from './imageResizeTypes'
export type { TrimBackground } from './imageResizeTypes'

export interface ImageResizeOptions {
  /** デフォルト off */
  trimMode?: TrimMode
  /** Sharp trim のしきい値 0–255（未指定時は IMAGE_TRIM_THRESHOLD または 10） */
  trimThreshold?: number
  /** Sharp trim の参照色（Vision 失敗時のフォールバックにも使用） */
  trimBackground?: TrimBackground
}

export interface ResizeResult {
  large: Buffer
  small: Buffer
}

function resolveTrimThreshold(override?: number): number {
  if (override !== undefined && Number.isFinite(override) && override >= 0 && override <= 255) {
    return Math.floor(override)
  }
  return getDefaultTrimThreshold()
}

/**
 * EXIF 適用後バッファに対し、trimMode に応じて余白除去。
 */
export async function prepareImageForResize(
  input: Buffer,
  options?: ImageResizeOptions
): Promise<Buffer> {
  const rotated = await sharp(input).rotate().toBuffer()
  const mode = options?.trimMode ?? 'off'
  if (mode === 'off') {
    return rotated
  }
  const threshold = resolveTrimThreshold(options?.trimThreshold)
  const bg: TrimBackground = options?.trimBackground ?? 'auto'
  if (mode === 'sharp') {
    const trimmed = await sharpTrimBuffer(rotated, threshold, bg)
    return applyTrimSanityCheck(rotated, trimmed)
  }
  return trimWithVisionOrSharpFallback(rotated, { threshold, trimBackground: bg })
}

/**
 * 画像をアスペクト比を維持したまま2サイズにリサイズする。
 * 指定サイズに収まるようにスケールし、必要なら余白（パディング）で中央配置する。
 * リサイズ前に EXIF Orientation を自動適用（rotate()）し、ブラウザ表示と一致させる。
 * @param input 入力画像の Buffer
 * @returns 大・小2つの JPEG Buffer
 */
export async function resizeToTwoSizes(input: Buffer, options?: ImageResizeOptions): Promise<ResizeResult> {
  const prepared = await prepareImageForResize(input, options)
  const { large, small } = TARGET_SIZES

  const [largeBuffer, smallBuffer] = await Promise.all([
    sharp(prepared)
      .resize(large.width, large.height, {
        fit: 'contain',
        position: 'centre',
        background: PADDING_COLOR,
      })
      .jpeg({ quality: 90 })
      .toBuffer(),
    sharp(prepared)
      .resize(small.width, small.height, {
        fit: 'contain',
        position: 'centre',
        background: PADDING_COLOR,
      })
      .jpeg({ quality: 90 })
      .toBuffer(),
  ])

  return { large: largeBuffer, small: smallBuffer }
}

/**
 * 画像をアスペクト比を維持したまま指定サイズにリサイズする。
 * 大容量バッチで 1 サイズのみ出力するときに使用する。
 * リサイズ前に EXIF Orientation を自動適用（rotate()）し、ブラウザ表示と一致させる。
 * @param input 入力画像の Buffer
 * @param size 'large' (640×533) または 'small' (262×218)
 * @returns リサイズ後の JPEG Buffer
 */
export async function resizeToSize(
  input: Buffer,
  size: 'large' | 'small',
  options?: ImageResizeOptions
): Promise<Buffer> {
  const prepared = await prepareImageForResize(input, options)
  const { width, height } = TARGET_SIZES[size]
  return sharp(prepared)
    .resize(width, height, {
      fit: 'contain',
      position: 'centre',
      background: PADDING_COLOR,
    })
    .jpeg({ quality: 90 })
    .toBuffer()
}
