import type { SnapMode, TimelineItem } from '../types';
import { ITEM_WIDTH } from '../constants';

/** Snap ms to the nearest grid unit */
export function snapTime(ms: number, mode: SnapMode): number {
  const grid = mode === '1s' ? 1000 : 100;
  return Math.round(ms / grid) * grid;
}

/**
 * After grid-snapping, snap to a nearby item on the same layer if within ITEM_WIDTH distance.
 * Returns the snapped timeMs (the other item's timeMs if close enough, otherwise the original).
 */
export function snapToNearestItem(
  timeMs: number,
  layerItems: TimelineItem[],
  excludeItemId: string,
  zoomLevel: number
): number {
  const thresholdMs = (ITEM_WIDTH / zoomLevel) * 1000;
  let closest: { timeMs: number; dist: number } | null = null;

  for (const other of layerItems) {
    if (other.id === excludeItemId) continue;
    const dist = Math.abs(timeMs - other.timeMs);
    if (dist <= thresholdMs && (!closest || dist < closest.dist)) {
      closest = { timeMs: other.timeMs, dist };
    }
  }

  return closest ? closest.timeMs : timeMs;
}
