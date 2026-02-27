/**
 * 画像リサイズのターゲット寸法（画像リサイズ企画のサンプル画像に準拠）
 * - 大: 008W-424_1.jpg → 640×533
 * - 小: 008W-424_1_s.jpg → 262×218
 */
export const TARGET_SIZES = {
  large: { width: 640, height: 533 },
  small: { width: 262, height: 218 },
} as const

/** 余白の色（デフォルト: 白） */
export const PADDING_COLOR = '#FFFFFF'
