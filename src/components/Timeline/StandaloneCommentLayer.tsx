import { useState } from 'react';
import type { StandaloneComment, SnapMode } from '../../types';
import { TIMELINE_PAD_RIGHT, STANDALONE_COMMENT_HEIGHT } from '../../constants';
import { snapTime } from '../../utils/snap';

interface Props {
  comments: StandaloneComment[];
  zoomLevel: number;
  zoomLevelRef: React.RefObject<number>;
  totalWidth: number;
  totalTimeMs: number;
  snapMode: SnapMode;
  snapModeRef: React.RefObject<SnapMode>;
  onDrop: (timeMs: number) => void;
  onMove: (id: string, timeMs: number) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, currentText: string) => void;
}

const BUBBLE_HEIGHT = 30;
const MIN_BUBBLE_WIDTH = 60;
const CHAR_WIDTH = 11;
const PAD_X = 10;

export function StandaloneCommentLayer({
  comments,
  zoomLevel,
  zoomLevelRef,
  totalWidth,
  totalTimeMs,
  snapMode,
  snapModeRef,
  onDrop,
  onMove,
  onRemove,
  onEdit,
}: Props) {
  const [dragState, setDragState] = useState<{ id: string; timeMs: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const timeToX = (ms: number) =>
    totalWidth - TIMELINE_PAD_RIGHT - (ms / 1000) * zoomLevel;

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-standalone-comment')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-standalone-comment')) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!e.dataTransfer.types.includes('application/x-standalone-comment')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let timeMs = ((totalWidth - TIMELINE_PAD_RIGHT - x) / zoomLevel) * 1000;
    timeMs = snapTime(Math.max(0, Math.min(totalTimeMs, timeMs)), snapModeRef.current ?? snapMode);
    onDrop(timeMs);
  };

  const handleBubbleMouseDown = (e: React.MouseEvent, comment: StandaloneComment) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const startClientX = e.clientX;
    const startTimeMs = comment.timeMs;
    setDragState({ id: comment.id, timeMs: startTimeMs });

    const onMouseMove = (me: MouseEvent) => {
      const delta = me.clientX - startClientX;
      const zoom = zoomLevelRef.current ?? zoomLevel;
      let newMs = startTimeMs - (delta / zoom) * 1000;
      newMs = snapTime(Math.max(0, Math.min(totalTimeMs, newMs)), snapModeRef.current ?? snapMode);
      setDragState({ id: comment.id, timeMs: newMs });
    };

    const onMouseUp = (me: MouseEvent) => {
      const delta = me.clientX - startClientX;
      const zoom = zoomLevelRef.current ?? zoomLevel;
      let newMs = startTimeMs - (delta / zoom) * 1000;
      newMs = snapTime(Math.max(0, Math.min(totalTimeMs, newMs)), snapModeRef.current ?? snapMode);
      onMove(comment.id, newMs);
      setDragState(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      className={`standalone-comment-layer${dragOver ? ' drag-over' : ''}`}
      style={{ width: totalWidth, height: STANDALONE_COMMENT_HEIGHT }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {comments.map((comment) => {
        const isDragging = dragState?.id === comment.id;
        const timeMs = isDragging ? dragState!.timeMs : comment.timeMs;
        const x = timeToX(timeMs);
        const bw = Math.max(MIN_BUBBLE_WIDTH, comment.text.length * CHAR_WIDTH + PAD_X * 2);
        const bubbleTop = (STANDALONE_COMMENT_HEIGHT - BUBBLE_HEIGHT) / 2;

        return (
          <div
            key={comment.id}
            className={`standalone-bubble${isDragging ? ' dragging' : ''}`}
            style={{
              left: x - bw / 2,
              top: bubbleTop,
              width: bw,
              height: BUBBLE_HEIGHT,
            }}
            onMouseDown={(e) => handleBubbleMouseDown(e, comment)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onEdit(comment.id, comment.text);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onRemove(comment.id);
            }}
            title={`${comment.text}（ドラッグで移動 / ダブルクリックで編集 / 右クリックで削除）`}
          >
            <span className="standalone-bubble-text">{comment.text}</span>
            <div className="standalone-bubble-arrow" />
          </div>
        );
      })}
      {dragState && (
        <div
          className="standalone-drag-line"
          style={{ left: timeToX(dragState.timeMs) }}
        />
      )}
    </div>
  );
}
