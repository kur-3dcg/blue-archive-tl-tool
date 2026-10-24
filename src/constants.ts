export const DEFAULT_TOTAL_TIME_MS = 240_000; // 4 minutes
export const MAX_TOTAL_TIME_MS = 600_000; // 10:00

export const TIME_PRESETS: { label: string; ms: number }[] = [
  { label: '3:00', ms: 180_000 },
  { label: '4:00', ms: 240_000 },
  { label: '4:30', ms: 270_000 },
  { label: '5:00', ms: 300_000 },
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
export const EXTENDED_STRIKER_COUNT = 6;
export const EXTENDED_SPECIAL_COUNT = 4;

export const STAGE_GIMMICK_PRESETS = [
  // 人数はコスト計算時にその時点で残っている人数（編成済み − 落とし生徒）で自動計算
  // dynamicPerStriker: ストライカー1人あたり加算, dynamicPerStudent: 生徒（ST+SP）1人あたり加算
  // fixedTimes: 一括登録する発動時間(ms)（省略時は発動時間を手入力）
  { label: 'コクマー バリスタ', dynamicPerStriker: 1000, durationMs: 22000 },
  { label: 'グレゴリオ', dynamicPerStudent: 300, durationMs: 60000, fixedTimes: [60000, 50000, 40000, 30000, 20000, 10000] as number[] },
  { label: 'セトの憤怒グロッキー', dynamicPerStudent: 500, durationMs: 23000, fixedTimes: [34333] as number[] },
  // recoveryPercent: 回復速度の乗算（%）, always: 戦闘開始から終了まで常時（発動時間=総時間、効果時間=総時間で登録）
  { label: 'ゲブラ 知性の根源', recoveryPercent: 25, always: true },
  // manualDuration: 効果時間を手入力
  { label: 'ゲブラ ラジエイター過負荷', dynamicPerStudent: 500, manualDuration: true },
] as const;

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
