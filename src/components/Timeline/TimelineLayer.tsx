import { useMemo, useState } from 'react';
import type { TimelineItem as TItem, CharacterSlot, SnapMode } from '../../types';
import { ITEM_WIDTH, LAYER_HEIGHT, TIMELINE_PAD_RIGHT } from '../../constants';
import { snapTime, snapToNearestItem } from '../../utils/snap';
import { TimelineItem } from './TimelineItem';
import { BuffBarLayer } from './BuffBarLayer';

interface Props {
  layerIndex: number;
  items: TItem[];
  allItems: TItem[];
  slots: CharacterSlot[];
  zoomLevel: number;
  snapMode: SnapMode;
  totalWidth: number;
  totalTimeMs: number;
  totalLayers: number;
  onDrop: (slotIndex: number, timeMs: number, layerIndex: number) => void;
  onMoveItem: (itemId: string, timeMs: number, layerIndex?: number) => void;
  onRemoveItem: (itemId: string) => void;
  onDoubleClickItem: (itemId: string) => void;
  onItemDragStart?: (itemId: string) => void;
  onItemDragEnd?: (itemId: string) => void;
  zoomLevelRef?: React.RefObject<number>;
  snapModeRef?: React.RefObject<SnapMode>;
  arrowMode?: boolean;
  onArrowClick?: (itemId: string) => void;
  arrowClickFrom?: string | null;
  itemCostMap?: Map<string, { cost: number; usedCost: number; isOverrun: boolean; isOvercost: boolean }>;
  onCostAdjust?: (itemId: string, delta: number) => void;
  onSetTarget?: (itemId: string, targetSlotIndex: number | undefined) => void;
  onToggleTimeDisplay?: (itemId: string) => void;
  onDropStandaloneComment?: (timeMs: number) => void;
}

interface ItemLayout {
  isInstant: boolean;
  xOffset: number; // px offset to the right (toward 0:00) to avoid visual overlap
}

export function TimelineLayer({
  layerIndex,
  items,
  allItems,
  slots,
  zoomLevel,
  snapMode,
  totalWidth,
  totalTimeMs,
  totalLayers,
  onDrop,
  onMoveItem,
  onRemoveItem,
  onDoubleClickItem,
  onItemDragStart,
  onItemDragEnd,
  zoomLevelRef,
  snapModeRef,
  arrowMode,
  onArrowClick,
  arrowClickFrom,
  itemCostMap,
  onCostAdjust,
  onSetTarget,
  onToggleTimeDisplay,
  onDropStandaloneComment,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  // Calculate instant detection and x-offsets for overlapping items
  const layoutMap = useMemo(() => {
    const map = new Map<string, ItemLayout>();

    // Sort by timeMs descending (left=large time first)
    const sorted = [...items].sort((a, b) => b.timeMs - a.timeMs);

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      // Calculate base x position (center of icon)
      const baseX = totalWidth - TIMELINE_PAD_RIGHT - (item.timeMs / 1000) * zoomLevel;

      // Look at previous items (already processed, higher or equal timeMs)
      // to check if we overlap
      let isInstant = false;
      let xOffset = 0;

      for (let j = i - 1; j >= 0; j--) {
        const prev = sorted[j];
        const prevLayout = map.get(prev.id)!;
        const prevBaseX = totalWidth - TIMELINE_PAD_RIGHT - (prev.timeMs / 1000) * zoomLevel;
        const prevEffectiveX = prevBaseX + prevLayout.xOffset;

        // Check if this item's base position overlaps with prev's effective position
        const distance = Math.abs(baseX - prevEffectiveX);
        if (distance <= ITEM_WIDTH) {
          isInstant = true;
          // Place to the right of prev item (toward 0:00 direction = positive x)
          xOffset = prevEffectiveX + ITEM_WIDTH - baseX;
          break;
        }
      }

      map.set(item.id, { isInstant, xOffset });
    }

    return map;
  }, [items, zoomLevel, totalWidth]);

  const isAcceptedDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes('application/x-slot-index') ||
    e.dataTransfer.types.includes('application/x-standalone-comment');

  const handleDragOver = (e: React.DragEvent) => {
    if (isAcceptedDrag(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (isAcceptedDrag(e)) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only toggle off when actually leaving this element (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const xInContainer = e.clientX - rect.left;
    let timeMs = ((totalWidth - TIMELINE_PAD_RIGHT - xInContainer) / zoomLevel) * 1000;
    timeMs = snapTime(Math.max(0, Math.min(totalTimeMs, timeMs)), snapMode);

    // Standalone comment drop
    if (e.dataTransfer.types.includes('application/x-standalone-comment')) {
      onDropStandaloneComment?.(timeMs);
      return;
    }

    const slotIndex = Number(e.dataTransfer.getData('application/x-slot-index'));
    if (isNaN(slotIndex)) return;
    // Also snap to nearby items on this layer
    timeMs = snapToNearestItem(timeMs, items, '', zoomLevel, totalWidth);
    onDrop(slotIndex, timeMs, layerIndex);
  };

  return (
    <div
      className={`timeline-layer${dragOver ? ' drag-over' : ''}`}
      style={{ height: LAYER_HEIGHT, width: totalWidth }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="timeline-layer-label">L{layerIndex + 1}</div>
      <BuffBarLayer
        items={items}
        slots={slots}
        layoutMap={layoutMap}
        zoomLevel={zoomLevel}
        totalWidth={totalWidth}
      />
      {items.map((item) => {
        const layout = layoutMap.get(item.id) ?? { isInstant: false, xOffset: 0 };
        return (
          <TimelineItem
            key={item.id}
            item={item}
            slot={slots[item.slotIndex]}
            zoomLevel={zoomLevel}
            snapMode={snapMode}
            totalWidth={totalWidth}
            totalTimeMs={totalTimeMs}
            totalLayers={totalLayers}
            isInstant={layout.isInstant}
            xOffset={layout.xOffset}
            allItems={allItems}
            onMove={onMoveItem}
            onRemove={onRemoveItem}
            onDoubleClick={onDoubleClickItem}
            onItemDragStart={onItemDragStart}
            onItemDragEnd={onItemDragEnd}
            zoomLevelRef={zoomLevelRef}
            snapModeRef={snapModeRef}
            arrowMode={arrowMode}
            onArrowClick={onArrowClick}
            arrowClickFrom={arrowClickFrom}
            costValue={itemCostMap?.get(item.id)?.usedCost}
            costOverrun={itemCostMap?.get(item.id)?.isOverrun}
            costOvercost={itemCostMap?.get(item.id)?.isOvercost}
            onCostAdjust={onCostAdjust}
            onSetTarget={onSetTarget}
            onToggleTimeDisplay={onToggleTimeDisplay}
            allSlots={slots}
          />
        );
      })}
    </div>
  );
}
