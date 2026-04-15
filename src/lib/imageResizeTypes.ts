/** クライアント・API で共有（sharp に依存しない） */
export type TrimMode = 'off' | 'sharp' | 'vision'

/** Sharp trim の参照色: auto=左上ピクセル（既定） / white=純白基準（テンプレ帯向け） */
export type TrimBackground = 'auto' | 'white'

/** 大容量バッチでは API コスト回避のため vision は使わない */
export type BatchTrimMode = 'off' | 'sharp'
