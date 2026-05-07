import { useMemo } from 'react';
import type { TimelineItem, CharacterSlot } from '../../types';
import { TIMELINE_PAD_RIGHT, LAYER_HEIGHT, SLOT_COLORS } from '../../constants';

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

interface Props {
  items: TimelineItem[];
  slots: CharacterSlot[];
  layoutMap: Map<string, ItemLayout>;
  zoomLevel: number;
  totalWidth: number;
}

export function BuffBarLayer({ items, slots, layoutMap, zoomLevel, totalWidth }: Props) {
  // exDuration があるアイテムだけバーを生成
  const bars = useMemo<BarInfo[]>(() => {
    const result: BarInfo[] = [];
    for (const item of items) {
      const char = slots[item.slotIndex]?.character;
      const dur = char?.exDuration;
      if (!dur) continue;
      const startX = totalWidth - TIMELINE_PAD_RIGHT - (item.timeMs / 1000) * zoomLevel;
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
  }, [items, slots, zoomLevel, totalWidth]);

  // 重なるバーを別の行に割り当てる（区間スケジューリング）
  // 行が多いほど下端ストリップが上にずれて重なりを視覚的に区別できる
  const rowMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    if (bars.length === 0) return map;
    const sorted = [...bars].sort((a, b) => a.startX - b.startX);
    const rowEndX: number[] = []; // 各行の最終 endX

    for (const bar of sorted) {
      let assigned = false;
      for (let row = 0; row < rowEndX.length; row++) {
        if (bar.startX >= rowEndX[row]) {
          map.set(bar.id, row);
          rowEndX[row] = bar.endX;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        const row = rowEndX.length;
        map.set(bar.id, row);
        rowEndX.push(bar.endX);
      }
    }
    return map;
  }, [bars]);

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
      {bars.map((bar) => {
        const row = rowMap.get(bar.id) ?? 0;
        const width = Math.max(0, bar.endX - bar.startX);
        // 下端ストリップは行ごとに上方向にずらして重なりを区別
        const stripY = LAYER_HEIGHT - STRIP_HEIGHT - row * STRIP_HEIGHT;

        return (
          <g key={bar.id}>
            {/* 半透明フィル */}
            <rect
              x={bar.startX}
              y={BAR_Y}
              width={width}
              height={BAR_HEIGHT}
              fill={bar.color}
              fillOpacity={FILL_OPACITY}
              rx={2}
            />
            {/* 不透明な下端ストリップ（重なり識別用、行ごとに上方向にずれる） */}
            <rect
              x={bar.startX}
              y={stripY}
              width={width}
              height={STRIP_HEIGHT}
              fill={bar.color}
              fillOpacity={STRIP_OPACITY}
            />
          </g>
        );
      })}
    </svg>
  );
}
