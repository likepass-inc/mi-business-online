import sharp from 'sharp'
import { TARGET_SIZES, PADDING_COLOR } from './imageResizeConfig'

export interface ResizeResult {
  large: Buffer
  small: Buffer
}

/**
 * 画像をアスペクト比を維持したまま2サイズにリサイズする。
 * 指定サイズに収まるようにスケールし、必要なら余白（パディング）で中央配置する。
 * リサイズ前に EXIF Orientation を自動適用（rotate()）し、ブラウザ表示と一致させる。
 * @param input 入力画像の Buffer
 * @returns 大・小2つの JPEG Buffer
 */
export async function resizeToTwoSizes(input: Buffer): Promise<ResizeResult> {
  const pipeline = sharp(input).rotate()
  const { large, small } = TARGET_SIZES

  const [largeBuffer, smallBuffer] = await Promise.all([
    pipeline
      .clone()
      .resize(large.width, large.height, {
        fit: 'contain',
        position: 'centre',
        background: PADDING_COLOR,
      })
      .jpeg({ quality: 90 })
      .toBuffer(),
    pipeline
      .clone()
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
export async function resizeToSize(input: Buffer, size: 'large' | 'small'): Promise<Buffer> {
  const { width, height } = TARGET_SIZES[size]
  return sharp(input)
    .rotate()
    .resize(width, height, {
      fit: 'contain',
      position: 'centre',
      background: PADDING_COLOR,
    })
    .jpeg({ quality: 90 })
    .toBuffer()
}
