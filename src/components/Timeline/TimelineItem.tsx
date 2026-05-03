import { useRef, useState, useCallback } from 'react';
import type { TimelineItem as TItem, CharacterSlot } from '../../types';
import { ITEM_WIDTH, LAYER_HEIGHT, TIMELINE_PAD_LEFT, TIMELINE_PAD_RIGHT } from '../../constants';
import { msToDisplay, costToDisplay } from '../../utils/timeFormat';
import { snapTime, snapToNearestItem } from '../../utils/snap';
import type { SnapMode } from '../../types';

const DOUBLE_CLICK_MS = 250; // ダブルクリック判定時間

interface Props {
  item: TItem;
  slot: CharacterSlot;
  zoomLevel: number;
  snapMode: SnapMode;
  totalWidth: number;
  totalTimeMs: number;
  totalLayers: number;
  isInstant: boolean;
  xOffset: number;
  allItems: TItem[];
  onMove: (itemId: string, timeMs: number, layerIndex?: number) => void;
  onRemove: (itemId: string) => void;
  onDoubleClick: (itemId: string) => void;
  onItemDragStart?: (itemId: string) => void;
  onItemDragEnd?: (itemId: string) => void;
  zoomLevelRef?: React.RefObject<number>;
  snapModeRef?: React.RefObject<SnapMode>;
  arrowMode?: boolean;
  onArrowDragStart?: (itemId: string) => void;
  costValue?: number;
  costOverrun?: boolean;
  onCostAdjust?: (itemId: string, delta: number) => void;
  onSetTarget?: (itemId: string, targetSlotIndex: number | undefined) => void;
  onToggleTimeDisplay?: (itemId: string) => void;
  allSlots?: CharacterSlot[];
}

export function TimelineItem({
  item,
  slot,
  zoomLevel,
  snapMode,
  totalWidth,
  totalTimeMs,
  totalLayers,
  isInstant,
  xOffset,
  allItems,
  onMove,
  onRemove,
  onDoubleClick,
  onItemDragStart,
  onItemDragEnd,
  zoomLevelRef,
  snapModeRef,
  arrowMode,
  onArrowDragStart,
  costValue,
  costOverrun,
  onCostAdjust,
  onSetTarget,
  onToggleTimeDisplay,
  allSlots,
}: Props) {
  const dragRef = useRef<{
    layerTop: number;
    moved: boolean;
    // Offset between mouse position and item center at drag start (in time ms)
    offsetMs: number;
  } | null>(null);
  const didDragRef = useRef(false);
  const character = slot.character;
  if (!character) return null;

  const baseX = totalWidth - TIMELINE_PAD_RIGHT - (item.timeMs / 1000) * zoomLevel - ITEM_WIDTH / 2;
  const x = baseX + xOffset;

  /** Convert a clientX to time (ms) using the given zoom level */
  const clientXToTime = (clientX: number, zoom: number): number => {
    const scrollContainer = document.querySelector('.timeline-scroll');
    if (!scrollContainer) return 0;
    const rect = scrollContainer.getBoundingClientRect();
    const scrollLeft = scrollContainer.scrollLeft;
    const xInContent = clientX - rect.left + scrollLeft;
    const totalTimeS = totalTimeMs / 1000;
    const contentWidth = TIMELINE_PAD_LEFT + totalTimeS * zoom + TIMELINE_PAD_RIGHT;
    return ((contentWidth - TIMELINE_PAD_RIGHT - xInContent) / zoom) * 1000;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (arrowMode) {
      onArrowDragStart?.(item.id);
      return;
    }

    const layersContainer = (e.currentTarget as HTMLElement).closest('.timeline-layers');
    const layerTop = layersContainer
      ? layersContainer.getBoundingClientRect().top
      : 0;

    // Calculate offset: difference between item's actual time and where the mouse is pointing
    const curZoom = zoomLevelRef?.current ?? zoomLevel;
    const mouseTimeMs = clientXToTime(e.clientX, curZoom);
    const offsetMs = item.timeMs - mouseTimeMs;

    didDragRef.current = false;

    dragRef.current = {
      layerTop,
      moved: false,
      offsetMs,
    };

    onItemDragStart?.(item.id);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      dragRef.current.moved = true;

      const curZoom = zoomLevelRef?.current ?? zoomLevel;
      const curSnap = snapModeRef?.current ?? snapMode;

      // Convert mouse position directly to time, add the initial offset
      const mouseTime = clientXToTime(ev.clientX, curZoom);
      let newTimeMs = mouseTime + dragRef.current.offsetMs;
      newTimeMs = snapTime(Math.max(0, Math.min(totalTimeMs, newTimeMs)), curSnap);

      const relY = ev.clientY - dragRef.current.layerTop;
      let newLayer = Math.floor(relY / LAYER_HEIGHT);
      newLayer = Math.max(0, Math.min(totalLayers - 1, newLayer));

      // Snap to nearby items on the destination layer only
      const destLayerItems = allItems.filter((it) => it.layerIndex === newLayer);
      newTimeMs = snapToNearestItem(newTimeMs, destLayerItems, item.id, curZoom);

      onMove(item.id, newTimeMs, newLayer);
    };

    const handleMouseUp = () => {
      didDragRef.current = dragRef.current?.moved ?? false;
      onItemDragEnd?.(item.id);
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [showTargetMenu, setShowTargetMenu] = useState(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onRemove(item.id);
  };

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey && !arrowMode) {
      e.preventDefault();
      e.stopPropagation();
      setShowTargetMenu((v) => !v);
      return;
    }
    if (didDragRef.current || arrowMode || e.shiftKey) return;

    clickCountRef.current += 1;
    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => {
        // シングルクリック: 表示切替
        if (clickCountRef.current === 1) {
          onToggleTimeDisplay?.(item.id);
        }
        clickCountRef.current = 0;
      }, DOUBLE_CLICK_MS);
    } else if (clickCountRef.current === 2) {
      // ダブルクリック: コメント
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      onDoubleClick(item.id);
    }
  }, [arrowMode, item.id, onToggleTimeDisplay, onDoubleClick]);

  const showCost = !item.useTimeDisplay && costValue !== undefined;
  const timeLabel = isInstant ? '即' : (
    showCost
      ? costToDisplay(costValue)
      : msToDisplay(item.timeMs)
  );

  // 対象スロットのキャラ画像
  const targetSlot = item.targetSlotIndex !== undefined ? allSlots?.[item.targetSlotIndex] : undefined;
  const targetChar = targetSlot?.character;

  const adj = item.costAdjustment ?? 0;

  return (
    <div
      className={`timeline-item${item.comment ? ' has-comment' : ''}${isInstant ? ' is-instant' : ''}${arrowMode ? ' arrow-mode' : ''}`}
      style={{ left: x }}
      data-item-id={item.id}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={`${character.name} - ${msToDisplay(item.timeMs)}${costValue !== undefined ? ` (コスト: ${costToDisplay(costValue)})` : ''}${isInstant ? '（即）' : ''}（クリックで表示切替 / ダブルクリックでコメント / 右クリックで削除 / Shift+クリックで対象指定）`}
    >
      {adj !== 0 && (
        <div className={`timeline-item-adj-badge${adj > 0 ? ' positive' : ' negative'}`}>
          {adj > 0 ? `+${adj}` : adj}
        </div>
      )}
      <img src={character.image} alt={character.name} width={48} height={48} />
      <div className={`timeline-item-time${showCost ? ' cost-mode' : ''}${costOverrun ? ' overrun' : ''}`}>{timeLabel}</div>
      {item.comment && <div className="timeline-item-comment-dot" />}
      {targetChar && (
        <img
          className="timeline-item-target"
          src={targetChar.image}
          alt={targetChar.name}
          width={24}
          height={24}
          title={`対象: ${targetChar.name}`}
        />
      )}
      {onCostAdjust && (
        <div className="timeline-item-cost-btns">
          <button
            className="cost-adjust-btn"
            onMouseDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); onCostAdjust(item.id, 1); }}
            title="スキルコスト +1"
          >+</button>
          <button
            className="cost-adjust-btn"
            onMouseDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); onCostAdjust(item.id, -1); }}
            title="スキルコスト -1"
          >-</button>
        </div>
      )}
      {showTargetMenu && allSlots && onSetTarget && (
        <div className="target-menu" onMouseDown={(e) => e.stopPropagation()}>
          <button
            className="target-menu-item"
            onClick={(e) => { e.stopPropagation(); onSetTarget(item.id, undefined); setShowTargetMenu(false); }}
          >
            なし
          </button>
          {allSlots.map((s, idx) =>
            s.character ? (
              <button
                key={idx}
                className={`target-menu-item${item.targetSlotIndex === idx ? ' active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onSetTarget(item.id, idx); setShowTargetMenu(false); }}
              >
                <img src={s.character.image} alt={s.character.name} width={20} height={20} />
                {s.character.name}
              </button>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
