import { useReducer, useEffect, useCallback } from 'react';
import type { TimelineState, TimelineAction, CharacterSlot, SlotCostConfig, GameMode, Character, StageGimmick } from '../types';
import stCharacters from '../../data/characters_st.json';
import spCharacters from '../../data/characters_sp.json';
import {
  STRIKER_COUNT,
  SPECIAL_COUNT,
  EXTENDED_STRIKER_COUNT,
  EXTENDED_SPECIAL_COUNT,
  DEFAULT_TOTAL_TIME_MS,
  MAX_LAYERS,
  MIN_LAYERS,
} from '../constants';

function getSlotCounts(mode: GameMode): { stCount: number; spCount: number } {
  return mode === 'extended'
    ? { stCount: EXTENDED_STRIKER_COUNT, spCount: EXTENDED_SPECIAL_COUNT }
    : { stCount: STRIKER_COUNT, spCount: SPECIAL_COUNT };
}

function createInitialSlots(mode: GameMode = 'normal'): CharacterSlot[] {
  const { stCount, spCount } = getSlotCounts(mode);
  const slots: CharacterSlot[] = [];
  for (let i = 0; i < stCount; i++) {
    slots.push({ type: 'striker', index: i, character: null });
  }
  for (let i = 0; i < spCount; i++) {
    slots.push({ type: 'special', index: i, character: null });
  }
  return slots;
}

function createInitialCostConfigs(mode: GameMode = 'normal'): SlotCostConfig[] {
  const { stCount, spCount } = getSlotCounts(mode);
  const configs: SlotCostConfig[] = [];
  for (let i = 0; i < stCount + spCount; i++) {
    configs.push({ skillCost: 3, hasUniqueWeapon4: false, hasUniqueWeapon2: true });
  }
  return configs;
}

const STORAGE_KEY = 'ba-tl-state';

const initialState: TimelineState = {
  mode: 'normal',
  slots: createInitialSlots(),
  items: [],
  arrows: [],
  layers: 2,
  snapMode: '1s',
  totalTimeMs: DEFAULT_TOTAL_TIME_MS,
  slotCostConfigs: createInitialCostConfigs(),
  targetTimeMs: undefined,
  standaloneComments: [],
  stageGimmicks: [],
};

function reducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case 'SET_CHARACTER': {
      const newSlots = state.slots.map((s, i) =>
        i === action.slotIndex ? { ...s, character: action.character } : s
      );
      // キャラ削除時、そのスロットのアイテムと関連する矢印も削除
      if (action.character === null) {
        const removedItemIds = new Set(
          state.items.filter((it) => it.slotIndex === action.slotIndex).map((it) => it.id)
        );
        return {
          ...state,
          slots: newSlots,
          items: state.items.filter((it) => it.slotIndex !== action.slotIndex),
          arrows: state.arrows.filter(
            (a) => !removedItemIds.has(a.fromItemId) && !removedItemIds.has(a.toItemId)
          ),
        };
      }
      // キャラ設定時、キャラのコストデータがあれば skillCost を自動設定（なければ 3）
      const autoSkillCost = action.character.cost ?? 3;
      const newCostConfigs = state.slotCostConfigs.map((c, i) =>
        i === action.slotIndex ? { ...c, skillCost: autoSkillCost } : c
      );
      return { ...state, slots: newSlots, slotCostConfigs: newCostConfigs };
    }

    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.item] };

    case 'MOVE_ITEM': {
      // 移動したアイテムを配列末尾に移動することで、ドラッグしたものが常にスタックの末尾（即チェーンの最後）になる
      const movedItem = state.items.find((it) => it.id === action.itemId);
      if (!movedItem) return state;
      const updatedItem = {
        ...movedItem,
        timeMs: action.timeMs,
        ...(action.layerIndex !== undefined ? { layerIndex: action.layerIndex } : {}),
      };
      return {
        ...state,
        items: [...state.items.filter((it) => it.id !== action.itemId), updatedItem],
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.itemId),
        arrows: state.arrows.filter(
          (a) => a.fromItemId !== action.itemId && a.toItemId !== action.itemId
        ),
      };

    case 'ADD_ARROW':
      return { ...state, arrows: [...state.arrows, action.arrow] };

    case 'REMOVE_ARROW':
      return {
        ...state,
        arrows: state.arrows.filter((a) => a.id !== action.arrowId),
      };

    case 'SET_COMMENT':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.itemId
            ? { ...item, comment: action.comment }
            : item
        ),
      };

    case 'SET_SNAP_MODE':
      return { ...state, snapMode: action.snapMode };

    case 'ADD_LAYER':
      return state.layers >= MAX_LAYERS
        ? state
        : { ...state, layers: state.layers + 1 };

    case 'REMOVE_LAYER': {
      if (state.layers <= MIN_LAYERS) return state;
      const newLayerCount = state.layers - 1;
      const removedIds = new Set(
        state.items.filter((item) => item.layerIndex >= newLayerCount).map((item) => item.id)
      );
      return {
        ...state,
        layers: newLayerCount,
        items: state.items.filter((item) => item.layerIndex < newLayerCount),
        arrows: state.arrows.filter(
          (a) => !removedIds.has(a.fromItemId) && !removedIds.has(a.toItemId)
        ),
      };
    }

    case 'SET_LAYERS': {
      const clamped = Math.max(MIN_LAYERS, Math.min(MAX_LAYERS, action.layers));
      const removedIds = new Set(
        state.items.filter((item) => item.layerIndex >= clamped).map((item) => item.id)
      );
      return {
        ...state,
        layers: clamped,
        items: state.items.filter((item) => item.layerIndex < clamped),
        arrows: state.arrows.filter(
          (a) => !removedIds.has(a.fromItemId) && !removedIds.has(a.toItemId)
        ),
      };
    }

    case 'SET_TOTAL_TIME': {
      return {
        ...state,
        totalTimeMs: action.totalTimeMs,
      };
    }

    case 'SET_SLOT_COST':
      return {
        ...state,
        slotCostConfigs: state.slotCostConfigs.map((c, i) =>
          i === action.slotIndex ? { ...c, skillCost: action.skillCost } : c
        ),
      };

    case 'SET_UNIQUE_WEAPON4':
      return {
        ...state,
        slotCostConfigs: state.slotCostConfigs.map((c, i) =>
          i === action.slotIndex ? { ...c, hasUniqueWeapon4: action.value } : c
        ),
      };

    case 'SET_UNIQUE_WEAPON2':
      return {
        ...state,
        slotCostConfigs: state.slotCostConfigs.map((c, i) =>
          i === action.slotIndex ? { ...c, hasUniqueWeapon2: action.value } : c
        ),
      };

    case 'SET_COST_ADJUSTMENT':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.itemId
            ? { ...item, costAdjustment: action.adjustment || undefined }
            : item
        ),
      };

    case 'SET_TARGET':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.itemId
            ? { ...item, targetSlotIndex: action.targetSlotIndex }
            : item
        ),
      };

    case 'TOGGLE_TIME_DISPLAY':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.itemId
            ? { ...item, useTimeDisplay: !item.useTimeDisplay }
            : item
        ),
      };

    case 'SET_TARGET_TIME':
      return { ...state, targetTimeMs: action.targetTimeMs };

    case 'ADD_STANDALONE_COMMENT':
      return {
        ...state,
        standaloneComments: [...state.standaloneComments, { id: action.id, timeMs: action.timeMs, text: action.text }],
      };

    case 'MOVE_STANDALONE_COMMENT':
      return {
        ...state,
        standaloneComments: state.standaloneComments.map((c) =>
          c.id === action.id ? { ...c, timeMs: action.timeMs } : c
        ),
      };

    case 'REMOVE_STANDALONE_COMMENT':
      return {
        ...state,
        standaloneComments: state.standaloneComments.filter((c) => c.id !== action.id),
      };

    case 'EDIT_STANDALONE_COMMENT':
      return {
        ...state,
        standaloneComments: state.standaloneComments.map((c) =>
          c.id === action.id ? { ...c, text: action.text } : c
        ),
      };

    case 'SET_STANDALONE_COMMENTS_BULK':
      return { ...state, standaloneComments: action.comments };

    case 'ADD_STAGE_GIMMICK':
      return { ...state, stageGimmicks: [...state.stageGimmicks, action.gimmick] };

    case 'REMOVE_STAGE_GIMMICK':
      return { ...state, stageGimmicks: state.stageGimmicks.filter((g) => g.id !== action.id) };

    case 'SET_STAGE_GIMMICKS':
      return { ...state, stageGimmicks: action.gimmicks };

    case 'SET_MODE': {
      if (action.mode === state.mode) return state;
      return {
        ...state,
        mode: action.mode,
        slots: createInitialSlots(action.mode),
        slotCostConfigs: createInitialCostConfigs(action.mode),
        items: [],
        arrows: [],
        standaloneComments: [],
        stageGimmicks: [],
      };
    }

    case 'LOAD_STATE': {
      const loadedMode = action.state.mode ?? 'normal';
      return {
        ...state,
        mode: loadedMode,
        slots: action.state.slots,
        items: action.state.items,
        arrows: action.state.arrows ?? [],
        layers: action.state.layers,
        totalTimeMs: action.state.totalTimeMs ?? state.totalTimeMs,
        slotCostConfigs: (action.state.slotCostConfigs ?? createInitialCostConfigs(loadedMode)).map((c) => ({
          ...c,
          hasUniqueWeapon2: c.hasUniqueWeapon2 ?? true,
        })),
        targetTimeMs: action.state.targetTimeMs,
        standaloneComments: action.state.standaloneComments ?? [],
        stageGimmicks: action.state.stageGimmicks ?? [],
      };
    }

    case 'RESET_ALL':
      return initialState;

    default:
      return state;
  }
}

// 名前からキャラクターデータを最新JSONで引き直す
const allCharacters: Character[] = [
  ...(stCharacters as Character[]),
  ...(spCharacters as Character[]),
];
function resolveCharacter(saved: Character | null): Character | null {
  if (!saved) return null;
  const fresh = allCharacters.find((c) => c.name === saved.name);
  return fresh ?? saved;
}

function loadFromStorage(base: TimelineState): TimelineState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return base;
    const parsed = JSON.parse(saved) as Partial<TimelineState>;
    const savedMode: GameMode = (parsed.mode as GameMode) ?? 'normal';
    const slots = (parsed.slots ?? createInitialSlots(savedMode)).map((s) => ({
      ...s,
      character: resolveCharacter(s.character),
    }));
    return {
      ...base,
      mode: savedMode,
      slots,
      items: parsed.items ?? base.items,
      arrows: parsed.arrows ?? base.arrows,
      layers: parsed.layers ?? base.layers,
      snapMode: parsed.snapMode ?? base.snapMode,
      totalTimeMs: parsed.totalTimeMs ?? base.totalTimeMs,
      slotCostConfigs: (parsed.slotCostConfigs ?? createInitialCostConfigs(savedMode)).map((c) => ({
        ...c,
        hasUniqueWeapon2: c.hasUniqueWeapon2 ?? true,
      })),
      targetTimeMs: parsed.targetTimeMs,
      standaloneComments: parsed.standaloneComments ?? base.standaloneComments,
      stageGimmicks: (parsed.stageGimmicks as StageGimmick[] | undefined) ?? base.stageGimmicks,
    };
  } catch {
    return base;
  }
}

export function useTimelineState() {
  const [state, dispatch] = useReducer(reducer, initialState, loadFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // quota exceeded 等は無視
    }
  }, [state]);

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'RESET_ALL' });
  }, []);

  return [state, dispatch, resetAll] as const;
}
