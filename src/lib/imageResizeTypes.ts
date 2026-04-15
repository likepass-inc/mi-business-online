/** クライアント・API で共有（sharp に依存しない） */
export type TrimMode = 'off' | 'sharp' | 'vision'

/** 大容量バッチでは API コスト回避のため vision は使わない */
export type BatchTrimMode = 'off' | 'sharp'
