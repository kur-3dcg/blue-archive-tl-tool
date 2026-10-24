import type { TimelineItem as TItem, CharacterSlot } from '../../types';
import { LAYER_HEIGHT, RULER_HEIGHT, STANDALONE_COMMENT_HEIGHT } from '../../constants';
import { layoutItemBubbles, ITEM_BUBBLE_HEIGHT, ITEM_BUBBLE_GAP } from '../../utils/commentLayout';
import { useCharName } from '../../i18n';

interface Props {
  items: TItem[];
  slots: CharacterSlot[];
  zoomLevel: number;
  totalWidth: number;
  onRemoveComment: (itemId: string) => void;
}

const BUBBLE_HEIGHT = ITEM_BUBBLE_HEIGHT;
const BUBBLE_GAP = ITEM_BUBBLE_GAP;

export function BubbleLayer({ items, slots, zoomLevel, totalWidth, onRemoveComment }: Props) {
  const charName = useCharName();
  const layout = layoutItemBubbles(items, zoomLevel, totalWidth);
  if (layout.bubbles.length === 0) return null;

  const bubbles = layout.bubbles.map((b) => ({
    ...b,
    anchorY: RULER_HEIGHT + STANDALONE_COMMENT_HEIGHT + b.item.layerIndex * LAYER_HEIGHT + LAYER_HEIGHT / 2,
  }));
  const bubbleAreaHeight = layout.height;

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
            title={`${charName(character ?? null)}: ${b.item.comment}（右クリックで削除）`}
          >
            <span className="bubble-text">{b.item.comment}</span>
            <div className="bubble-arrow" />
          </div>
        );
      })}
    </div>
  );
}
