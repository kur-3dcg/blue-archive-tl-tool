import { useMemo } from 'react';
import type { TimelineItem, CharacterSlot, SlotCostConfig } from '../../types';
import { TIMELINE_PAD_RIGHT, LAYER_HEIGHT, SLOT_COLORS } from '../../constants';

const BUFF_DURATION_MULTIPLIER = 1.19;

// アイコンと同じ高さ (48px) でレイヤー中央に配置
const BAR_HEIGHT = 48;
const BAR_Y = (LAYER_HEIGHT - BAR_HEIGHT) / 2;
const FILL_OPACITY = 0.18;
const STRIP_HEIGHT = 4; // 下端の帯（重なり識別用）
const STRIP_OPACITY = 0.8;

interface ItemLayout {
  xOffset: number;
}

interface BarInfo {
  id: string;
  slotIdx: number;
  startX: number;
  endX: number;
  color: string;
}

interface MergedInterval {
  startX: number;
  endX: number;
}

interface Props {
  items: TimelineItem[];
  slots: CharacterSlot[];
  slotCostConfigs: SlotCostConfig[];
  layoutMap: Map<string, ItemLayout>;
  zoomLevel: number;
  totalWidth: number;
}

export function BuffBarLayer({ items, slots, slotCostConfigs, layoutMap, zoomLevel, totalWidth }: Props) {
  // exDuration があるアイテムだけバーを生成
  const bars = useMemo<BarInfo[]>(() => {
    const result: BarInfo[] = [];
    for (const item of items) {
      const char = slots[item.slotIndex]?.character;
      if (!char) continue;
      const activeSkill = item.skillIndex !== undefined && item.skillIndex > 0
        ? char.skills?.[item.skillIndex]
        : undefined;
      const baseDur = activeSkill !== undefined ? activeSkill.exDuration : char.exDuration;
      if (!baseDur) continue;
      const config = slotCostConfigs[item.slotIndex];
      const hasUnique2 = (config?.hasUniqueWeapon2 || config?.hasUniqueWeapon4) ?? false;
      const dur = (char.hasDurationBuff && hasUnique2)
        ? baseDur * BUFF_DURATION_MULTIPLIER
        : baseDur;
      const delayS = slotCostConfigs[item.slotIndex]?.exDelay ?? char.exDelay ?? 0;
      const startX = totalWidth - TIMELINE_PAD_RIGHT - ((item.timeMs / 1000) - delayS) * zoomLevel;
      const width = dur * zoomLevel;
      result.push({
        id: item.id,
        slotIdx: item.slotIndex,
        startX,
        endX: startX + width,
        color: SLOT_COLORS[item.slotIndex % SLOT_COLORS.length],
      });
    }
    return result;
  }, [items, slots, slotCostConfigs, zoomLevel, totalWidth]);

  // スロットごとにバーをマージ（同スロットの重なりを1区間に統合）
  // フィル・ストリップ両方の描画に使用
  const mergedBySlot = useMemo(() => {
    const bySlot = new Map<number, { intervals: MergedInterval[]; color: string }>();
    for (const bar of bars) {
      if (!bySlot.has(bar.slotIdx)) {
        bySlot.set(bar.slotIdx, { intervals: [], color: bar.color });
      }
      bySlot.get(bar.slotIdx)!.intervals.push({ startX: bar.startX, endX: bar.endX });
    }
    const result = new Map<number, { merged: MergedInterval[]; color: string }>();
    for (const [slotIdx, { intervals, color }] of bySlot) {
      const sorted = [...intervals].sort((a, b) => a.startX - b.startX);
      const merged: MergedInterval[] = [];
      for (const iv of sorted) {
        if (merged.length === 0 || iv.startX > merged[merged.length - 1].endX) {
          merged.push({ ...iv });
        } else {
          merged[merged.length - 1].endX = Math.max(merged[merged.length - 1].endX, iv.endX);
        }
      }
      result.set(slotIdx, { merged, color });
    }
    return result;
  }, [bars]);

  // スロット単位の行割り当て（異スロット間の重なりのみ判定）
  // 同スロットのバーは常に同じ行 → ストリップが伸びるだけで積み重ならない
  const slotRowMap = useMemo(() => {
    const map = new Map<number, number>();
    const slotEntries = [...mergedBySlot.entries()].sort((a, b) => {
      const aMin = a[1].merged[0]?.startX ?? 0;
      const bMin = b[1].merged[0]?.startX ?? 0;
      return aMin - bMin;
    });
    const rowIntervals: MergedInterval[][] = [];

    const overlapsRow = (row: number, intervals: MergedInterval[]) => {
      for (const iv of intervals) {
        for (const riv of rowIntervals[row]) {
          if (iv.startX < riv.endX && iv.endX > riv.startX) return true;
        }
      }
      return false;
    };

    for (const [slotIdx, { merged }] of slotEntries) {
      let assignedRow = -1;
      for (let row = 0; row < rowIntervals.length; row++) {
        if (!overlapsRow(row, merged)) {
          assignedRow = row;
          break;
        }
      }
      if (assignedRow === -1) {
        assignedRow = rowIntervals.length;
        rowIntervals.push([]);
      }
      map.set(slotIdx, assignedRow);
      for (const iv of merged) {
        rowIntervals[assignedRow].push(iv);
      }
    }
    return map;
  }, [mergedBySlot]);

  if (bars.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: totalWidth,
        height: LAYER_HEIGHT,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {/* 半透明フィル: 同スロットはマージ済みで色の重複なし、別スロットは重なりあり */}
      {[...mergedBySlot.entries()].flatMap(([slotIdx, { merged, color }]) =>
        merged.map((m, i) => (
          <rect
            key={`fill-${slotIdx}-${i}`}
            x={m.startX}
            y={BAR_Y}
            width={Math.max(0, m.endX - m.startX)}
            height={BAR_HEIGHT}
            fill={color}
            fillOpacity={FILL_OPACITY}
            rx={2}
          />
        ))
      )}
      {/* 下端ストリップ: スロット単位でマージ済み区間を描画（同スロットは伸びるだけ、異スロットは行ずれ） */}
      {[...mergedBySlot.entries()].flatMap(([slotIdx, { merged, color }]) => {
        const row = slotRowMap.get(slotIdx) ?? 0;
        const stripY = LAYER_HEIGHT - STRIP_HEIGHT - row * STRIP_HEIGHT;
        return merged.map((m, i) => (
          <rect
            key={`strip-${slotIdx}-${i}`}
            x={m.startX}
            y={stripY}
            width={Math.max(0, m.endX - m.startX)}
            height={STRIP_HEIGHT}
            fill={color}
            fillOpacity={STRIP_OPACITY}
          />
        ));
      })}
    </svg>
  );
}
