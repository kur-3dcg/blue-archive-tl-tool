import type { SnapMode, TimelineItem } from '../types';
import { ITEM_WIDTH, TIMELINE_PAD_RIGHT } from '../constants';

/** Snap ms to the nearest grid unit */
export function snapTime(ms: number, mode: SnapMode): number {
  const grid = mode === '1s' ? 1000 : 100;
  return Math.round(ms / grid) * grid;
}

/**
 * After grid-snapping, snap to a nearby item on the same layer if within ITEM_WIDTH distance.
 * Uses the items' effective pixel positions (accounting for xOffset due to stacking),
 * so that dropping anywhere within a visual stack correctly snaps to the stack's timeMs.
 *
 * Returns the snapped timeMs (the other item's timeMs if close enough, otherwise the original).
 */
export function snapToNearestItem(
  dropTimeMs: number,
  layerItems: TimelineItem[],
  excludeItemId: string,
  zoomLevel: number,
  totalWidth: number
): number {
  const eligible = layerItems.filter((it) => it.id !== excludeItemId);
  if (eligible.length === 0) return dropTimeMs;

  // Compute effective x positions for each item (same algorithm as layoutMap in TimelineLayer)
  const sorted = [...eligible].sort((a, b) => b.timeMs - a.timeMs);
  const effectiveXMap = new Map<string, number>();

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const baseX = totalWidth - TIMELINE_PAD_RIGHT - (item.timeMs / 1000) * zoomLevel;
    let xOffset = 0;
    let maxEffX = -Infinity;

    for (let j = i - 1; j >= 0; j--) {
      const prev = sorted[j];
      const prevEffX = effectiveXMap.get(prev.id)!;
      const prevBaseX = totalWidth - TIMELINE_PAD_RIGHT - (prev.timeMs / 1000) * zoomLevel;
      const directOverlap = Math.abs(baseX - prevEffX) <= ITEM_WIDTH;
      const sameBase = Math.abs(prevBaseX - baseX) < 0.5;
      if ((directOverlap || sameBase) && prevEffX > maxEffX) {
        maxEffX = prevEffX;
      }
    }

    if (maxEffX > -Infinity) {
      xOffset = maxEffX + ITEM_WIDTH - baseX;
    }

    effectiveXMap.set(item.id, baseX + xOffset);
  }

  // Find the closest item by pixel distance to the drop position
  const dropX = totalWidth - TIMELINE_PAD_RIGHT - (dropTimeMs / 1000) * zoomLevel;
  let closest: { timeMs: number; distPx: number } | null = null;

  for (const item of eligible) {
    const effX = effectiveXMap.get(item.id)!;
    const distPx = Math.abs(dropX - effX);
    if (distPx < ITEM_WIDTH && (!closest || distPx < closest.distPx)) {
      closest = { timeMs: item.timeMs, distPx };
    }
  }

  return closest ? closest.timeMs : dropTimeMs;
}
