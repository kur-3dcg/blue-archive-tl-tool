export interface EtcIcon {
  name: string;
  image: string;
  showWhen: string | null;
  textPrefix?: string;
}

export interface CharacterSkill {
  label: string;           // "EX1" | "EX2"
  image: string;           // スキル使用時の顔アイコン
  cost?: number;
  exDuration?: number | null;
  exDelay?: number;
}

export interface Character {
  name: string;
  image: string;
  reading?: string;
  school?: string;
  attackType?: string;
  armorType?: string;
  cost?: number;
  exDuration?: number | null;
  exDelay?: number; // EXスキル発動から効果着弾までのディレイ（秒）。省略は0扱い
  hasDurationBuff?: boolean; // 固有2↑でバフ効果持続力×1.19
  skills?: CharacterSkill[]; // 複数EXスキルを持つ場合
  nameEn?: string;
  nameKr?: string;
  nameTw?: string;
  nameCn?: string;
}

export type SlotType = 'striker' | 'special';

export interface CharacterSlot {
  type: SlotType;
  index: number;
  character: Character | null;
}

export interface SlotCostConfig {
  skillCost: number;       // 現在アクティブなスキルのコスト（UI表示用）
  hasUniqueWeapon4: boolean; // 固有4（SPのみ、コスト上限+0.5）
  hasUniqueWeapon2: boolean; // 固有2↑（バフ効果持続力×1.19）
  exDelay?: number;        // EXスキル発動→効果着弾ディレイ（秒、省略は0扱い）
  activeSkillIndex?: number; // 選択中スキルバリアント（0 = EX1 / デフォルト）
  skillCosts?: number[];   // スキルバリアントごとの個別コスト（複数EX持ちのみ）
}

export interface TimelineItem {
  id: string;
  slotIndex: number; // which character slot (0-5)
  timeMs: number; // position in ms (0-240000)
  layerIndex: number;
  comment?: string;
  costAdjustment?: number;   // 手動コスト増減
  targetSlotIndex?: number;  // EX対象スロット
  targetEtcIcon?: string;    // etc対象アイコン名
  useTimeDisplay?: boolean;  // true=時間表示（デフォルトはコスト表示）
  skillIndex?: number;       // 使用スキルバリアント（0 = EX1 / デフォルト）
}

export type SnapMode = '0.1s' | '1F';

export type GameMode = 'normal' | 'extended';

export interface TimelineArrow {
  id: string;
  fromItemId: string;
  toItemId: string;
}

export interface TimelineState {
  mode: GameMode;
  slots: CharacterSlot[];
  items: TimelineItem[];
  arrows: TimelineArrow[];
  layers: number; // number of layers (1-6)
  snapMode: SnapMode;
  totalTimeMs: number; // total timeline duration in ms
  slotCostConfigs: SlotCostConfig[]; // 6 or 10スロット分
  targetTimeMs?: number; // 目標時間（赤い線で表示）
  standaloneComments: StandaloneComment[];
  stageGimmicks: StageGimmick[];
  skillQueueOrder?: number[]; // スキル使用順（slotIndexの配列）。undefinedはスロット番号順
}

export interface StandaloneComment {
  id: string;
  timeMs: number;
  text: string;
}

export interface StageGimmick {
  id: string;
  timeMs: number;       // 発動時刻（カウントダウン方向）
  durationMs: number;   // 効果時間
  recoveryDelta: number; // 回復力増加量
  label?: string;       // 表示名
}

export type TimelineAction =
  | { type: 'SET_CHARACTER'; slotIndex: number; character: Character | null }
  | { type: 'ADD_ITEM'; item: TimelineItem }
  | { type: 'MOVE_ITEM'; itemId: string; timeMs: number; layerIndex?: number }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'SET_COMMENT'; itemId: string; comment: string | undefined }
  | { type: 'ADD_ARROW'; arrow: TimelineArrow }
  | { type: 'REMOVE_ARROW'; arrowId: string }
  | { type: 'SET_SNAP_MODE'; snapMode: SnapMode }
  | { type: 'SET_TARGET_TIME'; targetTimeMs: number | undefined }
  | { type: 'ADD_LAYER' }
  | { type: 'REMOVE_LAYER' }
  | { type: 'SET_LAYERS'; layers: number }
  | { type: 'SET_TOTAL_TIME'; totalTimeMs: number }
  | { type: 'SET_SLOT_COST'; slotIndex: number; skillCost: number }
  | { type: 'SET_SLOT_DELAY'; slotIndex: number; exDelay: number }
  | { type: 'SET_UNIQUE_WEAPON4'; slotIndex: number; value: boolean }
  | { type: 'SET_UNIQUE_WEAPON2'; slotIndex: number; value: boolean }
  | { type: 'SET_COST_ADJUSTMENT'; itemId: string; adjustment: number }
  | { type: 'SET_TARGET'; itemId: string; targetSlotIndex: number | undefined }
  | { type: 'SET_TARGET_ETC'; itemId: string; targetEtcIcon: string | undefined }
  | { type: 'TOGGLE_TIME_DISPLAY'; itemId: string }
  | { type: 'ADD_STANDALONE_COMMENT'; id: string; timeMs: number; text: string }
  | { type: 'MOVE_STANDALONE_COMMENT'; id: string; timeMs: number }
  | { type: 'REMOVE_STANDALONE_COMMENT'; id: string }
  | { type: 'EDIT_STANDALONE_COMMENT'; id: string; text: string }
  | { type: 'SET_STANDALONE_COMMENTS_BULK'; comments: StandaloneComment[] }
  | { type: 'ADD_STAGE_GIMMICK'; gimmick: StageGimmick }
  | { type: 'REMOVE_STAGE_GIMMICK'; id: string }
  | { type: 'SET_STAGE_GIMMICKS'; gimmicks: StageGimmick[] }
  | { type: 'LOAD_STATE'; state: Pick<TimelineState, 'slots' | 'items' | 'arrows' | 'layers' | 'totalTimeMs'> & { mode?: GameMode; slotCostConfigs?: SlotCostConfig[]; targetTimeMs?: number; heavyArmorCount?: number; redWinterCount?: number; standaloneComments?: StandaloneComment[]; stageGimmicks?: StageGimmick[]; skillQueueOrder?: number[] } }
  | { type: 'SET_MODE'; mode: GameMode }
  | { type: 'SET_SLOT_SKILL_INDEX'; slotIndex: number; skillIndex: number }
  | { type: 'SET_SKILL_QUEUE_ORDER'; order: number[] | undefined }
  | { type: 'RESET_ALL' };
