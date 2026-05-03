import type { TimelineItem as TItem, CharacterSlot } from '../../types';
import { ITEM_WIDTH, LAYER_HEIGHT, RULER_HEIGHT, TIMELINE_PAD_RIGHT } from '../../constants';

interface Props {
  items: TItem[];
  slots: CharacterSlot[];
  zoomLevel: number;
  totalWidth: number;
  onRemoveComment: (itemId: string) => void;
}

const BUBBLE_HEIGHT = 32;
const BUBBLE_GAP = 4;
const BUBBLE_MIN_WIDTH = 60;

interface BubblePos {
  item: TItem;
  x: number;
  anchorY: number;
  row: number;
}

export function BubbleLayer({ items, slots, zoomLevel, totalWidth, onRemoveComment }: Props) {
  const commented = items.filter((it) => it.comment);
  if (commented.length === 0) return null;

  // Calculate bubble positions, stacking rows to avoid overlap
  const bubbles: BubblePos[] = [];
  // Sort by x position (left to right)
  const sorted = [...commented].sort((a, b) => {
    const ax = totalWidth - TIMELINE_PAD_RIGHT - (a.timeMs / 1000) * zoomLevel;
    const bx = totalWidth - TIMELINE_PAD_RIGHT - (b.timeMs / 1000) * zoomLevel;
    return ax - bx;
  });

  // Track occupied ranges per row
  const rowOccupied: { left: number; right: number }[][] = [[]];

  for (const item of sorted) {
    const cx = totalWidth - TIMELINE_PAD_RIGHT - (item.timeMs / 1000) * zoomLevel;
    const textWidth = Math.max(BUBBLE_MIN_WIDTH, (item.comment?.length ?? 0) * 13 + 20);
    const left = cx - textWidth / 2;
    const right = cx + textWidth / 2;
    const anchorY = RULER_HEIGHT + item.layerIndex * LAYER_HEIGHT + LAYER_HEIGHT / 2;

    // Find the lowest row where this bubble fits
    let placed = false;
    for (let row = 0; row < rowOccupied.length; row++) {
      const overlaps = rowOccupied[row].some(
        (r) => left - BUBBLE_GAP < r.right && right + BUBBLE_GAP > r.left
      );
      if (!overlaps) {
        rowOccupied[row].push({ left, right });
        bubbles.push({ item, x: cx, anchorY, row });
        placed = true;
        break;
      }
    }
    if (!placed) {
      const newRow = rowOccupied.length;
      rowOccupied.push([{ left, right }]);
      bubbles.push({ item, x: cx, anchorY, row: newRow });
    }
  }

  const totalRows = rowOccupied.length;
  const bubbleAreaHeight = totalRows * (BUBBLE_HEIGHT + BUBBLE_GAP) + 8;

  return (
    <div className="bubble-layer" style={{ height: bubbleAreaHeight, width: totalWidth }}>
      <svg className="bubble-lines" width={totalWidth} height={bubbleAreaHeight + RULER_HEIGHT + items.length * LAYER_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
        {bubbles.map((b) => {
          const bubbleY = bubbleAreaHeight - (b.row + 1) * (BUBBLE_HEIGHT + BUBBLE_GAP) + BUBBLE_HEIGHT / 2;
          const lineEndY = b.anchorY + bubbleAreaHeight;
          return (
            <line
              key={b.item.id}
              x1={b.x}
              y1={bubbleY + BUBBLE_HEIGHT / 2}
              x2={b.x}
              y2={lineEndY}
              stroke="var(--comment-dot)"
              opacity={0.35}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          );
        })}
      </svg>
      {bubbles.map((b) => {
        const bubbleY = bubbleAreaHeight - (b.row + 1) * (BUBBLE_HEIGHT + BUBBLE_GAP);
        const character = slots[b.item.slotIndex]?.character;
        return (
          <div
            key={b.item.id}
            className="bubble"
            style={{ left: b.x, top: bubbleY }}
            onContextMenu={(e) => {
              e.preventDefault();
              onRemoveComment(b.item.id);
            }}
            title={`${character?.name ?? ''}: ${b.item.comment}（右クリックで削除）`}
          >
            <span className="bubble-text">{b.item.comment}</span>
            <div className="bubble-arrow" />
          </div>
        );
      })}
    </div>
  );
}
