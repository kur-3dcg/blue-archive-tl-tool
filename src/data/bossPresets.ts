import type {
  Character,
  CharacterSlot,
  SlotCostConfig,
  GameMode,
  StandaloneComment,
  StageGimmick,
  TimelineItem,
  TimelineArrow,
} from '../types';
import {
  STRIKER_COUNT,
  EXTENDED_STRIKER_COUNT,
  SPECIAL_COUNT,
  EXTENDED_SPECIAL_COUNT,
} from '../constants';

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────

export interface BossPresetSlot {
  name: string;
  type: 'striker' | 'special';
}

export interface BossPresetGimmick {
  label: string;
  timeMs: number;
  durationMs: number;
  recoveryDelta: number;
}

export interface BossPresetComment {
  timeMs: number;
  text: string;
}

export interface BossPresetEntry {
  name: string;                       // bosses.json の name と一致（アイコン引き当て用）
  totalTimeMs?: number;               // 省略時: 現在値を維持
  mode?: 'normal' | 'extended';      // 省略時: 'normal'
  slots?: BossPresetSlot[];           // 省略時: 全空スロット
  gimmicks?: BossPresetGimmick[];    // 省略時: ギミックなし
  comments?: BossPresetComment[];    // 省略時: コメントなし
}

/** LOAD_STATE アクションの state に直接渡せる型 */
export interface BossPresetLoadState {
  slots: CharacterSlot[];
  items: TimelineItem[];
  arrows: TimelineArrow[];
  layers: number;
  totalTimeMs: number;
  mode?: GameMode;
  slotCostConfigs?: SlotCostConfig[];
  standaloneComments?: StandaloneComment[];
  stageGimmicks?: StageGimmick[];
  nsBarOffsets?: Record<number, number[]>;
  nsConditionalTicks?: Record<number, number[]>;
}

// ─────────────────────────────────────────
// ボスプリセットデータ
// ─────────────────────────────────────────

export const BOSS_PRESETS: BossPresetEntry[] = [
  {
    name: 'セトの憤怒',
    totalTimeMs: 270_000, // 4:30
    mode: 'extended',
    slots: [
      { name: 'ホシノ（水着）', type: 'striker' },
      { name: 'カズサ（バンド）', type: 'striker' },
      { name: 'ノノミ（水着）', type: 'striker' },
      { name: 'ヨシミ（バンド）', type: 'striker' },
      { name: 'ナツ（バンド）', type: 'striker' },
      { name: 'スズミ（マジカル）', type: 'striker' },
      { name: 'シロコ（水着）', type: 'special' },
      { name: 'チヒロ', type: 'special' },
      { name: 'キキョウ（水着）', type: 'special' },
      { name: 'レイサ（マジカル）', type: 'special' },
    ],
    gimmicks: [
      { label: 'セトの憤怒グロッキー', timeMs: 34333, durationMs: 23000, recoveryDelta: 5000 },
    ],
    comments: [
      { timeMs: 256867, text: '蒼雷の咆哮(All230%)' },
      { timeMs: 242033, text: '蒼雷の渦(All390%)' },
      { timeMs: 234167, text: '落雷' },
      { timeMs: 220800, text: '赤玉(All475%)' },
      { timeMs: 203867, text: '落雷' },
      { timeMs: 199400, text: '蒼雷の咆哮(All230%)' },
      { timeMs: 187633, text: '赤玉(All475%)' },
      { timeMs: 166767, text: '蒼雷の咆哮(All230%)' },
      { timeMs: 165166, text: '落雷' },
      { timeMs: 150166, text: '蒼雷の渦(All390%)' },
      { timeMs: 135500, text: '赤玉(All475%)' },
      { timeMs: 122133, text: '蒼雷の咆哮(All230%)' },
      { timeMs: 134433, text: '落雷' },
      { timeMs: 112533, text: '破裂する光彩(All480%)' },
      { timeMs: 100333, text: '落雷' },
      { timeMs: 95633, text: '蒼雷の渦(All390%)' },
      { timeMs: 81300, text: '赤玉(All475%)' },
      { timeMs: 63300, text: '破裂する光彩(All480%)' },
      { timeMs: 50100, text: '落雷' },
      { timeMs: 41100, text: '憤怒の雷槍(410%)' },
      { timeMs: 29300, text: '赤玉(All475%)' },
      { timeMs: 14233, text: '落雷' },
    ],
  },
];

// ─────────────────────────────────────────
// プリセット適用関数
// ─────────────────────────────────────────

/**
 * BossPresetEntry を LOAD_STATE に渡せる形に変換する。
 * - slots: characters_st/sp.json から名前引き当て
 * - slotCostConfigs: キャラのコスト・exDelay を自動反映
 * - stageGimmicks / standaloneComments: UUID を付与
 * - items / arrows / nsBarOffsets / nsConditionalTicks: 空
 */
export function applyBossPreset(
  preset: BossPresetEntry,
  stChars: Character[],
  spChars: Character[]
): BossPresetLoadState {
  const mode: GameMode = preset.mode ?? 'normal';
  const stCount = mode === 'extended' ? EXTENDED_STRIKER_COUNT : STRIKER_COUNT;
  const spCount = mode === 'extended' ? EXTENDED_SPECIAL_COUNT : SPECIAL_COUNT;
  const totalSlots = stCount + spCount;

  const stMap = new Map(stChars.map((c) => [c.name, c]));
  const spMap = new Map(spChars.map((c) => [c.name, c]));

  // スロット配列を構築（まず全スロットを空で初期化）
  const slots: CharacterSlot[] = [
    ...Array.from({ length: stCount }, (_, i) => ({
      type: 'striker' as const,
      index: i,
      character: null,
    })),
    ...Array.from({ length: spCount }, (_, i) => ({
      type: 'special' as const,
      index: stCount + i,
      character: null,
    })),
  ];

  // プリセットの slots をタイプ順に詰める
  if (preset.slots) {
    let stIdx = 0;
    let spIdx = stCount;
    for (const ps of preset.slots) {
      if (ps.type === 'striker' && stIdx < stCount) {
        slots[stIdx].character = stMap.get(ps.name) ?? null;
        stIdx++;
      } else if (ps.type === 'special' && spIdx < totalSlots) {
        slots[spIdx].character = spMap.get(ps.name) ?? null;
        spIdx++;
      }
    }
  }

  // SlotCostConfig をキャラデータから自動設定
  const slotCostConfigs: SlotCostConfig[] = slots.map((slot) => {
    const char = slot.character;
    return {
      skillCost: char?.cost ?? 3,
      hasUniqueWeapon4: false,
      hasUniqueWeapon2: true,
      exDelay: char?.exDelay ?? 0,
      activeSkillIndex: 0,
      skillCosts: char?.skills
        ? char.skills.map((sk) => sk.cost ?? char.cost ?? 3)
        : undefined,
    };
  });

  const stageGimmicks: StageGimmick[] = (preset.gimmicks ?? []).map((g) => ({
    id: crypto.randomUUID(),
    timeMs: g.timeMs,
    durationMs: g.durationMs,
    recoveryDelta: g.recoveryDelta,
    label: g.label,
  }));

  const standaloneComments: StandaloneComment[] = (preset.comments ?? []).map((c) => ({
    id: crypto.randomUUID(),
    timeMs: c.timeMs,
    text: c.text,
  }));

  return {
    slots,
    items: [],
    arrows: [],
    layers: 1,
    totalTimeMs: preset.totalTimeMs ?? 240_000,
    mode,
    slotCostConfigs,
    standaloneComments,
    stageGimmicks,
    nsBarOffsets: {},
    nsConditionalTicks: {},
  };
}
