import { useReducer } from 'react';
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
    configs.push({ skillCost: 3, hasUniqueWeapon4: false });
  }
  return configs;
}

const initialState: TimelineState = {
  slots: createInitialSlots(),
  items: [],
  arrows: [],
  layers: 2,
  snapMode: '1s',
  totalTimeMs: DEFAULT_TOTAL_TIME_MS,
  slotCostConfigs: createInitialCostConfigs(),
  targetTimeMs: undefined,
  heavyArmorCount: 0,
  redWinterCount: 0,
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
      return { ...state, slots: newSlots };
    }

    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.item] };

    case 'MOVE_ITEM':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.itemId
            ? {
                ...item,
                timeMs: action.timeMs,
                ...(action.layerIndex !== undefined
                  ? { layerIndex: action.layerIndex }
                  : {}),
              }
            : item
        ),
      };

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

    case 'SET_HEAVY_ARMOR_COUNT':
      return { ...state, heavyArmorCount: Math.max(0, Math.min(3, action.count)) };

    case 'SET_RED_WINTER_COUNT':
      return { ...state, redWinterCount: Math.max(0, Math.min(3, action.count)) };

    case 'LOAD_STATE':
      return {
        ...state,
        slots: action.state.slots,
        items: action.state.items,
        arrows: action.state.arrows ?? [],
        layers: action.state.layers,
        totalTimeMs: action.state.totalTimeMs ?? state.totalTimeMs,
        slotCostConfigs: action.state.slotCostConfigs ?? createInitialCostConfigs(),
        targetTimeMs: action.state.targetTimeMs,
        heavyArmorCount: action.state.heavyArmorCount ?? 0,
        redWinterCount: action.state.redWinterCount ?? 0,
      };

    default:
      return state;
  }
}

export function useTimelineState() {
  return useReducer(reducer, initialState);
}
