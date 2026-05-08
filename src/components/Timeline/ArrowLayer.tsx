import type { TimelineArrow, TimelineItem } from '../../types';
import { TIMELINE_PAD_RIGHT, LAYER_HEIGHT, ITEM_WIDTH } from '../../constants';

interface Props {
  arrows: TimelineArrow[];
  items: TimelineItem[];
  zoomLevel: number;
  totalWidth: number;
  totalHeight: number;
  itemXOffsetMap: Map<string, number>;
  previewLine: { fromX: number; fromY: number; toX: number; toY: number } | null;
  onRemoveArrow: (arrowId: string) => void;
}

export function ArrowLayer({
  arrows,
  items,
  zoomLevel,
  totalWidth,
  totalHeight,
  itemXOffsetMap,
  previewLine,
  onRemoveArrow,
}: Props) {
  const itemMap = new Map(items.map((item) => [item.id, item]));

  const getItemCenter = (itemId: string): { x: number; y: number } | null => {
    const item = itemMap.get(itemId);
    if (!item) return null;
    const xOffset = itemXOffsetMap.get(itemId) ?? 0;
    const x = totalWidth - TIMELINE_PAD_RIGHT - (item.timeMs / 1000) * zoomLevel + xOffset;
    const y = item.layerIndex * LAYER_HEIGHT + LAYER_HEIGHT / 2;
    return { x, y };
  };

  return (
    <svg
      className="arrow-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: totalWidth,
        height: totalHeight,
        pointerEvents: 'none',
        zIndex: 7,
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="var(--arrow-color, #ff9800)" />
        </marker>
        <marker
          id="arrowhead-preview"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="var(--arrow-preview-color, rgba(255,152,0,0.5))" />
        </marker>
      </defs>

      {arrows.map((arrow) => {
        const from = getItemCenter(arrow.fromItemId);
        const to = getItemCenter(arrow.toItemId);
        if (!from || !to) return null;

        // Shorten line to stop at item icon edge
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return null;
        const iconRadius = ITEM_WIDTH / 2;
        const startX = from.x + (dx / dist) * iconRadius;
        const startY = from.y + (dy / dist) * iconRadius;
        const endX = to.x - (dx / dist) * iconRadius;
        const endY = to.y - (dy / dist) * iconRadius;

        return (
          <g key={arrow.id}>
            {/* 見た目の矢印 */}
            <line
              x1={startX} y1={startY} x2={endX} y2={endY}
              stroke="var(--arrow-color, #ff9800)"
              strokeWidth={2.5}
              markerEnd="url(#arrowhead)"
              style={{ pointerEvents: 'none' }}
            />
            {/* 当たり判定用の透明な太い線（右クリックで削除） */}
            <line
              x1={startX} y1={startY} x2={endX} y2={endY}
              stroke="rgba(0,0,0,0)"
              strokeWidth={16}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemoveArrow(arrow.id);
              }}
            />
          </g>
        );
      })}

      {previewLine && (
        <line
          x1={previewLine.fromX}
          y1={previewLine.fromY}
          x2={previewLine.toX}
          y2={previewLine.toY}
          stroke="var(--arrow-preview-color, rgba(255,152,0,0.5))"
          strokeWidth={2}
          strokeDasharray="6 4"
          markerEnd="url(#arrowhead-preview)"
        />
      )}
    </svg>
  );
}
