import { useReducer, useEffect, useCallback } from 'react';
import type { TimelineState, TimelineAction, CharacterSlot, SlotCostConfig } from '../types';
import {
  STRIKER_COUNT,
  SPECIAL_COUNT,
  DEFAULT_TOTAL_TIME_MS,
  MAX_LAYERS,
  MIN_LAYERS,
} from '../constants';

function createInitialSlots(): CharacterSlot[] {
  const slots: CharacterSlot[] = [];
  for (let i = 0; i < STRIKER_COUNT; i++) {
    slots.push({ type: 'striker', index: i, character: null });
  }
  for (let i = 0; i < SPECIAL_COUNT; i++) {
    slots.push({ type: 'special', index: i, character: null });
  }
  return slots;
}

function createInitialCostConfigs(): SlotCostConfig[] {
  const configs: SlotCostConfig[] = [];
  for (let i = 0; i < STRIKER_COUNT + SPECIAL_COUNT; i++) {
    configs.push({ skillCost: 3, hasUniqueWeapon4: false, hasUniqueWeapon2: true });
  }
  return configs;
}

const STORAGE_KEY = 'ba-tl-state';

const initialState: TimelineState = {
  slots: createInitialSlots(),
  items: [],
  arrows: [],
  layers: 2,
  snapMode: '1s',
  totalTimeMs: DEFAULT_TOTAL_TIME_MS,
  slotCostConfigs: createInitialCostConfigs(),
  targetTimeMs: undefined,
  standaloneComments: [],
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

    case 'LOAD_STATE':
      return {
        ...state,
        slots: action.state.slots,
        items: action.state.items,
        arrows: action.state.arrows ?? [],
        layers: action.state.layers,
        totalTimeMs: action.state.totalTimeMs ?? state.totalTimeMs,
        slotCostConfigs: (action.state.slotCostConfigs ?? createInitialCostConfigs()).map((c) => ({
          ...c,
          hasUniqueWeapon2: c.hasUniqueWeapon2 ?? true,
        })),
        targetTimeMs: action.state.targetTimeMs,
        standaloneComments: action.state.standaloneComments ?? [],
      };

    case 'RESET_ALL':
      return initialState;

    default:
      return state;
  }
}

function loadFromStorage(base: TimelineState): TimelineState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return base;
    const parsed = JSON.parse(saved) as Partial<TimelineState>;
    return {
      ...base,
      slots: parsed.slots ?? base.slots,
      items: parsed.items ?? base.items,
      arrows: parsed.arrows ?? base.arrows,
      layers: parsed.layers ?? base.layers,
      snapMode: parsed.snapMode ?? base.snapMode,
      totalTimeMs: parsed.totalTimeMs ?? base.totalTimeMs,
      slotCostConfigs: (parsed.slotCostConfigs ?? base.slotCostConfigs).map((c) => ({
        ...c,
        hasUniqueWeapon2: c.hasUniqueWeapon2 ?? true,
      })),
      targetTimeMs: parsed.targetTimeMs,
      standaloneComments: parsed.standaloneComments ?? base.standaloneComments,
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
