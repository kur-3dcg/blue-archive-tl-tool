import { useMemo, useState, useEffect, Fragment } from 'react';
import type { CharacterSlot, SnapMode } from '../../types';
import { useCharName } from '../../i18n';
import { TIMELINE_PAD_RIGHT, SLOT_COLORS } from '../../constants';
import { snapTime } from '../../utils/snap';

export const NS_LAYER_HEIGHT = 30;
const NS_ICON_SIZE = 24;
const NS_TICK_WIDTH = 2;

interface Props {
  slots: CharacterSlot[];
  totalWidth: number;
  totalTimeMs: number;
  zoomLevel: number;
  nsBarOffsets?: Record<number, number[]>;
  onAdjustNsBar: (slotIndex: number, barIndex: number, deltaMs: number) => void;
  onResetNsBar: (slotIndex: number, fromBarIndex: number) => void;
  onDragChange?: (dragging: boolean) => void;
  nsSnapMode?: SnapMode;
}

interface DragState {
  slotIndex: number;
  barIndex: number;
  startX: number;
}

interface ResetTarget {
  slotIndex: number;
  barIndex: number;
  clientX: number;
  clientY: number;
}

export function NSLayerSection({ slots, totalWidth, totalTimeMs, zoomLevel, nsBarOffsets, onAdjustNsBar, onResetNsBar, onDragChange, nsSnapMode = '0.1s' }: Props) {
  const charName = useCharName();
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);

  // ドラッグ中のマウスイベント
  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setDragDeltaX(e.clientX - dragging.startX);
    };
    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - dragging.startX;
      // 右移動 = 後ろ（小さいtimeMs）= adjustment増加
      const rawDeltaMs = deltaX / zoomLevel * 1000;
      const deltaMs = snapTime(rawDeltaMs, nsSnapMode);
      if (Math.abs(deltaMs) > 0) {
        onAdjustNsBar(dragging.slotIndex, dragging.barIndex, deltaMs);
      }
      setDragging(null);
      setDragDeltaX(0);
      onDragChange?.(false);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, zoomLevel, onAdjustNsBar]);

  // リセットメニュー外クリックで閉じる
  useEffect(() => {
    if (!resetTarget) return;
    const handler = () => setResetTarget(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [resetTarget]);

  const nsSlots = useMemo(() =>
    slots
      .map((slot, slotIndex) => ({ slot, slotIndex }))
      .filter(({ slot }) => {
        const c = slot.character;
        return c && (c.nsInterval !== undefined || c.nsConditional === true);
      }),
    [slots]
  );

  if (nsSlots.length === 0) return null;

  const maxX = totalWidth - TIMELINE_PAD_RIGHT;

  return (
    <div className="ns-layer-section" style={{ width: totalWidth }}>
      {nsSlots.map(({ slot, slotIndex }, rowIndex) => {
        const char = slot.character!;
        const color = SLOT_COLORS[slotIndex % SLOT_COLORS.length];
        const nsDelay = char.nsDelay ?? 0;
        const nsDuration = char.nsDuration ?? 0;
        const slotAdj = nsBarOffsets?.[slotIndex] ?? [];

        // バー位置計算（cumulative offset込み）
        const bars: { barIndex: number; xFire: number; xBuffStart: number; buffWidth: number; isDragging: boolean }[] = [];
        if (char.nsInterval) {
          let cumulative = 0;
          for (let bi = 0; ; bi++) {
            const baseFireMs = totalTimeMs - char.nsInterval * 1000 * (bi + 1);
            if (baseFireMs <= 0) break;
            cumulative += slotAdj[bi] ?? 0;
            const fireMs = baseFireMs - cumulative;

            const isDragging = dragging?.slotIndex === slotIndex && dragging?.barIndex === bi;
            const extraX = isDragging ? dragDeltaX : 0;
            const xFire = totalWidth - TIMELINE_PAD_RIGHT - (fireMs / 1000) * zoomLevel + extraX;
            const xBuffStart = Math.min(xFire + nsDelay * zoomLevel, maxX);
            const xBuffEnd = Math.min(xFire + (nsDelay + nsDuration) * zoomLevel, maxX);
            const buffWidth = Math.max(0, xBuffEnd - xBuffStart);
            bars.push({ barIndex: bi, xFire, xBuffStart, buffWidth, isDragging });
          }
        }

        return (
          <div
            key={slotIndex}
            className={`ns-layer-row${rowIndex % 2 === 0 ? '' : ' ns-layer-row-alt'}`}
          >
            <div className="ns-layer-icon-area" title={charName(char)}>
              <img src={char.image} alt={char.name} width={NS_ICON_SIZE} height={NS_ICON_SIZE} />
            </div>
            {bars.map(({ barIndex, xFire, xBuffStart, buffWidth, isDragging }) => (
              <Fragment key={barIndex}>
                {nsDuration > 0 && buffWidth > 0 && (
                  <>
                    <div
                      className="ns-buff-bar"
                      style={{ left: xBuffStart, width: buffWidth, background: color, opacity: isDragging ? 0.4 : 0.22 }}
                    />
                    <div
                      className="ns-bar-start-icon"
                      style={{ left: xFire - 8, borderColor: color }}
                    >
                      <img src={char.image} alt={char.name} />
                    </div>
                  </>
                )}
                <div
                  className={`ns-tick${isDragging ? ' dragging' : ''}`}
                  style={{ left: xFire - NS_TICK_WIDTH / 2, background: color }}
                  title="ドラッグ: 移動（以降もシフト）/ Shift+クリック: 以降をリセット"
                  onMouseDown={(e) => {
                    if (e.shiftKey) return;
                    e.preventDefault();
                    setDragging({ slotIndex, barIndex, startX: e.clientX });
                    setResetTarget(null);
                    onDragChange?.(true);
                  }}
                  onClick={(e) => {
                    if (!e.shiftKey) return;
                    e.stopPropagation();
                    setResetTarget({ slotIndex, barIndex, clientX: e.clientX, clientY: e.clientY + 6 });
                  }}
                />
              </Fragment>
            ))}
          </div>
        );
      })}

      {/* リセットメニュー */}
      {resetTarget && (
        <div
          className="ns-reset-menu"
          style={{ left: resetTarget.clientX, top: resetTarget.clientY }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="ns-reset-btn"
            onClick={() => {
              onResetNsBar(resetTarget.slotIndex, resetTarget.barIndex);
              setResetTarget(null);
            }}
          >
            この発動以降をリセット
          </button>
        </div>
      )}
    </div>
  );
}
