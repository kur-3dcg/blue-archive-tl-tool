export const DEFAULT_TOTAL_TIME_MS = 240_000; // 4 minutes
export const MAX_TOTAL_TIME_MS = 270_000; // 4:30

export const TIME_PRESETS: { label: string; ms: number }[] = [
  { label: '3:00', ms: 180_000 },
  { label: '4:00', ms: 240_000 },
  { label: '4:30', ms: 270_000 },
];

export const VIEWPORT_DURATION_S = 60; // ビューポートに表示する時間幅（秒）

export const ITEM_WIDTH = 64; // px
export const LAYER_HEIGHT = 100; // px
export const RULER_HEIGHT = 36; // px
export const TIMELINE_PAD_LEFT = 60; // px - padding on max-time side (left edge)
export const TIMELINE_PAD_RIGHT = 60; // px - padding on 0:00 side (right edge)

export const MAX_LAYERS = 4;
export const STANDALONE_COMMENT_HEIGHT = 44; // px - スタンドアロンコメントストリップの高さ
export const MIN_LAYERS = 1;

export const STRIKER_COUNT = 4;
export const SPECIAL_COUNT = 2;

// スロットごとのバフバー色（将来10スロット対応想定）
export const SLOT_COLORS = [
  '#29B6F6', // 0 - 水色
  '#F06292', // 1 - ピンク
  '#66BB6A', // 2 - 緑
  '#FFA726', // 3 - オレンジ
  '#AB47BC', // 4 - 紫
  '#26C6DA', // 5 - シアン
  '#EF5350', // 6 - 赤
  '#FFEE58', // 7 - 黄
  '#26A69A', // 8 - ティール
  '#8D6E63', // 9 - ブラウン
];
