import { useRef, useState, useCallback, useEffect } from 'react';
import type { TimelineItem as TItem, CharacterSlot, EtcIcon } from '../../types';
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
  onArrowClick?: (itemId: string) => void;
  arrowClickFrom?: string | null;
  costValue?: number;
  costOverrun?: boolean;
  costOvercost?: boolean;
  onCostAdjust?: (itemId: string, delta: number) => void;
  onSetTarget?: (itemId: string, targetSlotIndex: number | undefined) => void;
  onSetTargetEtc?: (itemId: string, targetEtcIcon: string | undefined) => void;
  onToggleTimeDisplay?: (itemId: string) => void;
  allSlots?: CharacterSlot[];
  etcIcons?: EtcIcon[];
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
  onArrowClick,
  arrowClickFrom,
  costValue,
  costOverrun,
  costOvercost,
  onCostAdjust,
  onSetTarget,
  onSetTargetEtc,
  onToggleTimeDisplay,
  allSlots,
  etcIcons,
}: Props) {
  const dragRef = useRef<{
    layerTop: number;
    moved: boolean;
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
      onArrowClick?.(item.id);
      return;
    }

    const layersContainer = (e.currentTarget as HTMLElement).closest('.timeline-layers');
    const layerTop = layersContainer
      ? layersContainer.getBoundingClientRect().top
      : 0;

    didDragRef.current = false;

    dragRef.current = {
      layerTop,
      moved: false,
    };

    onItemDragStart?.(item.id);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      dragRef.current.moved = true;

      const curZoom = zoomLevelRef?.current ?? zoomLevel;
      const curSnap = snapModeRef?.current ?? snapMode;

      // Snap mouse position directly to grid (no offset, always aligns to snap grid)
      const mouseTime = clientXToTime(ev.clientX, curZoom);
      let newTimeMs = snapTime(Math.max(0, Math.min(totalTimeMs, mouseTime)), curSnap);

      const relY = ev.clientY - dragRef.current.layerTop;
      let newLayer = Math.floor(relY / LAYER_HEIGHT);
      newLayer = Math.max(0, Math.min(totalLayers - 1, newLayer));

      // Snap to nearby items on the destination layer only
      const destLayerItems = allItems.filter((it) => it.layerIndex === newLayer);
      newTimeMs = snapToNearestItem(newTimeMs, destLayerItems, item.id, curZoom, totalWidth);

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
  const itemRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!showTargetMenu) return;
    const handler = (e: MouseEvent) => {
      if (!itemRef.current?.contains(e.target as Node)) {
        setShowTargetMenu(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [showTargetMenu]);

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
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      onArrowClick?.(item.id);
      return;
    }
    if (didDragRef.current || arrowMode || e.shiftKey) return;

    clickCountRef.current += 1;
    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => {
        if (clickCountRef.current === 1) {
          onToggleTimeDisplay?.(item.id);
        }
        clickCountRef.current = 0;
      }, DOUBLE_CLICK_MS);
    } else if (clickCountRef.current === 2) {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      onDoubleClick(item.id);
    }
  }, [arrowMode, item.id, onToggleTimeDisplay, onDoubleClick, onArrowClick]);

  const showCost = !item.useTimeDisplay && costValue !== undefined;
  const timeLabel = isInstant ? '即' : (
    showCost
      ? costToDisplay(costValue)
      : msToDisplay(item.timeMs)
  );

  // 対象スロットのキャラ画像（右上表示）
  const targetSlot = item.targetSlotIndex !== undefined ? allSlots?.[item.targetSlotIndex] : undefined;
  const targetChar = targetSlot?.character;

  // etc対象アイコン（左上表示）
  const targetEtcIconData = item.targetEtcIcon
    ? etcIcons?.find((e) => e.name === item.targetEtcIcon)
    : undefined;

  const adj = item.costAdjustment ?? 0;

  return (
    <div
      ref={itemRef}
      className={`timeline-item${item.comment ? ' has-comment' : ''}${isInstant ? ' is-instant' : ''}${arrowMode ? ' arrow-mode' : ''}${arrowClickFrom === item.id ? ' arrow-from' : ''}`}
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
      <div className={`timeline-item-time${showCost ? ' cost-mode' : ''}${costOverrun ? ' overrun' : ''}${costOvercost ? ' overcost' : ''}`}>{timeLabel}</div>
      {item.comment && <div className="timeline-item-comment-dot" />}
      {targetEtcIconData && (
        <img
          className="timeline-item-target-etc"
          src={targetEtcIconData.image}
          alt={targetEtcIconData.name}
          width={24}
          height={24}
          title={`対象: ${targetEtcIconData.name}`}
        />
      )}
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
          {etcIcons && etcIcons.length > 0 && (
            <>
              {etcIcons.map((icon) => (
                <button
                  key={icon.name}
                  className={`target-menu-item${item.targetEtcIcon === icon.name ? ' active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetTargetEtc?.(item.id, item.targetEtcIcon === icon.name ? undefined : icon.name);
                  }}
                >
                  <img src={icon.image} alt={icon.name} width={20} height={20} />
                  {icon.name}
                </button>
              ))}
              <div className="target-menu-separator" />
            </>
          )}
          <button
            className="target-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              onSetTarget(item.id, undefined);
              onSetTargetEtc?.(item.id, undefined);
              setShowTargetMenu(false);
            }}
          >
            なし（全解除）
          </button>
          {allSlots.map((s, idx) =>
            s.character ? (
              <button
                key={idx}
                className={`target-menu-item${item.targetSlotIndex === idx ? ' active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onSetTarget(item.id, idx); }}
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
