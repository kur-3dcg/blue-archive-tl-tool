export interface Character {
  name: string;
  image: string;
  reading?: string;
  school?: string;
  attackType?: string;
  armorType?: string;
  cost?: number;
  exDuration?: number | null;
}

export type SlotType = 'striker' | 'special';

export interface CharacterSlot {
  type: SlotType;
  index: number;
  character: Character | null;
}

export interface SlotCostConfig {
  skillCost: number;       // スキルコスト（デフォルト3）
  hasUniqueWeapon4: boolean; // 固有4（SPのみ、コスト上限+0.5）
  hasUniqueWeapon2: boolean; // 固有2↑（バフ効果持続力×1.19）
}

export interface TimelineItem {
  id: string;
  slotIndex: number; // which character slot (0-5)
  timeMs: number; // position in ms (0-240000)
  layerIndex: number;
  comment?: string;
  costAdjustment?: number;   // 手動コスト増減
  targetSlotIndex?: number;  // EX対象スロット
  useTimeDisplay?: boolean;  // true=時間表示（デフォルトはコスト表示）
}

export type SnapMode = '1s' | '0.1s';

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
}

export interface StandaloneComment {
  id: string;
  timeMs: number;
  text: string;
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
  | { type: 'SET_UNIQUE_WEAPON4'; slotIndex: number; value: boolean }
  | { type: 'SET_UNIQUE_WEAPON2'; slotIndex: number; value: boolean }
  | { type: 'SET_COST_ADJUSTMENT'; itemId: string; adjustment: number }
  | { type: 'SET_TARGET'; itemId: string; targetSlotIndex: number | undefined }
  | { type: 'TOGGLE_TIME_DISPLAY'; itemId: string }
  | { type: 'ADD_STANDALONE_COMMENT'; id: string; timeMs: number; text: string }
  | { type: 'MOVE_STANDALONE_COMMENT'; id: string; timeMs: number }
  | { type: 'REMOVE_STANDALONE_COMMENT'; id: string }
  | { type: 'EDIT_STANDALONE_COMMENT'; id: string; text: string }
  | { type: 'SET_STANDALONE_COMMENTS_BULK'; comments: StandaloneComment[] }
  | { type: 'LOAD_STATE'; state: Pick<TimelineState, 'slots' | 'items' | 'arrows' | 'layers' | 'totalTimeMs'> & { mode?: GameMode; slotCostConfigs?: SlotCostConfig[]; targetTimeMs?: number; heavyArmorCount?: number; redWinterCount?: number; standaloneComments?: StandaloneComment[] } }
  | { type: 'SET_MODE'; mode: GameMode }
  | { type: 'RESET_ALL' };
