import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { TimelineState, TimelineAction, SnapMode } from '../../types';
import { RULER_HEIGHT, LAYER_HEIGHT, ITEM_WIDTH, MAX_LAYERS, TIME_PRESETS, TIMELINE_PAD_LEFT, TIMELINE_PAD_RIGHT, VIEWPORT_DURATION_S, MAX_TOTAL_TIME_MS } from '../../constants';
import { TimelineRuler } from './TimelineRuler';
import { TimelineLayer } from './TimelineLayer';
import { TimelineCursor } from './TimelineCursor';
import { BubbleLayer } from './BubbleLayer';
import { ArrowLayer } from './ArrowLayer';
import { CostRuler, COST_RULER_HEIGHT } from './CostRuler';
import { snapTime } from '../../utils/snap';
import { calculateItemCosts } from '../../utils/costCalc';
import { costToDisplay } from '../../utils/timeFormat';
import './Timeline.css';

interface Props {
  state: TimelineState;
  dispatch: React.Dispatch<TimelineAction>;
  arrowMode: boolean;
}

let nextItemId = 1;

let nextArrowId = 1;

export function Timeline({ state, dispatch, arrowMode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorX, setCursorX] = useState(0);
  const [cursorTimeMs, setCursorTimeMs] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [dragInfo, setDragInfo] = useState<{ timeMs: number; itemId: string } | null>(null);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [targetTimeInput, setTargetTimeInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [arrowDragFrom, setArrowDragFrom] = useState<string | null>(null);
  const [arrowDragMouse, setArrowDragMouse] = useState<{ x: number; y: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const { snapMode, layers, items, arrows, slots, totalTimeMs, slotCostConfigs, targetTimeMs } = state;
  const totalTimeS = totalTimeMs / 1000;

  // zoomLevel をビューポート幅から自動算出
  const zoomLevel = (containerWidth - TIMELINE_PAD_LEFT - TIMELINE_PAD_RIGHT) / VIEWPORT_DURATION_S;
  const totalWidth = TIMELINE_PAD_LEFT + totalTimeS * zoomLevel + TIMELINE_PAD_RIGHT;

  // ビューポート移動用: 30秒刻み
  const SCROLL_STEP_S = 30;

  // ResizeObserver でコンテナ幅を監視
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Ctrl+Wheel でブラウザズームを防止（ズーム機能は削除済み）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Compute xOffset for all items (instant items get shifted right)
  const itemXOffsetMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let layer = 0; layer < layers; layer++) {
      const layerItems = items.filter((it) => it.layerIndex === layer);
      const sorted = [...layerItems].sort((a, b) => b.timeMs - a.timeMs);
      for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        const baseX = totalWidth - TIMELINE_PAD_RIGHT - (item.timeMs / 1000) * zoomLevel;
        let xOffset = 0;
        for (let j = i - 1; j >= 0; j--) {
          const prev = sorted[j];
          const prevBaseX = totalWidth - TIMELINE_PAD_RIGHT - (prev.timeMs / 1000) * zoomLevel;
          const prevOffset = map.get(prev.id) ?? 0;
          const prevEffectiveX = prevBaseX + prevOffset;
          const distance = Math.abs(baseX - prevEffectiveX);
          if (distance < ITEM_WIDTH) {
            xOffset = prevEffectiveX + ITEM_WIDTH - baseX;
            break;
          }
        }
        map.set(item.id, xOffset);
      }
    }
    return map;
  }, [items, layers, zoomLevel, totalWidth]);

  // Calculate cost for each item
  const itemCostMap = useMemo(() => {
    return calculateItemCosts(slots, items, slotCostConfigs, totalTimeMs, state.heavyArmorCount, state.redWinterCount);
  }, [slots, items, slotCostConfigs, totalTimeMs, state.heavyArmorCount, state.redWinterCount]);

  // ビューポート移動（30秒刻み）
  const scrollByStep = useCallback((direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;
    const stepPx = SCROLL_STEP_S * zoomLevel;
    // タイムライン方向: 左が大きい時間、右が0:00
    // "左"ボタン = 大きい時間方向 = scrollLeftを減らす
    // "右"ボタン = 小さい時間方向 = scrollLeftを増やす
    const delta = direction === 'right' ? stepPx : -stepPx;
    container.scrollBy({ left: delta, behavior: 'smooth' });
  }, [zoomLevel]);

  // Keep zoomLevel/snapMode accessible to event handlers via refs
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;
  const snapRef = useRef(snapMode);
  snapRef.current = snapMode;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const xInContent = e.clientX - rect.left + scrollLeft;
      const timeMs = ((totalWidth - TIMELINE_PAD_RIGHT - xInContent) / zoomLevel) * 1000;
      const clampedTime = Math.max(0, Math.min(totalTimeMs, timeMs));

      setCursorX(xInContent);
      setCursorTimeMs(snapTime(clampedTime, snapMode));
      setCursorVisible(true);
    },
    [totalWidth, zoomLevel, snapMode, totalTimeMs]
  );

  const handleDrop = useCallback(
    (slotIndex: number, timeMs: number, layerIndex: number) => {
      if (!slots[slotIndex]?.character) return;
      dispatch({
        type: 'ADD_ITEM',
        item: {
          id: `item-${nextItemId++}`,
          slotIndex,
          timeMs,
          layerIndex,
        },
      });
    },
    [slots, dispatch]
  );

  const handleMoveItem = useCallback(
    (itemId: string, timeMs: number, layerIndex?: number) => {
      dispatch({ type: 'MOVE_ITEM', itemId, timeMs, layerIndex });
      setDragInfo({ timeMs, itemId });
    },
    [dispatch]
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      dispatch({ type: 'REMOVE_ITEM', itemId });
    },
    [dispatch]
  );

  const handleItemDragStart = useCallback(
    (_itemId: string) => {
      // ズーム機能削除のため、ドラッグ開始時の処理は不要
    },
    []
  );

  const handleItemDragEnd = useCallback(
    (_itemId: string) => {
      // ズーム機能削除のため、ドラッグ終了時の処理は不要
    },
    []
  );

  const handleDoubleClickItem = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      setEditingCommentId(itemId);
      setCommentInput(item?.comment ?? '');
    },
    [items]
  );

  const handleCommentSubmit = useCallback(() => {
    if (editingCommentId === null) return;
    const trimmed = commentInput.trim();
    dispatch({
      type: 'SET_COMMENT',
      itemId: editingCommentId,
      comment: trimmed || undefined,
    });
    setEditingCommentId(null);
    setCommentInput('');
  }, [editingCommentId, commentInput, dispatch]);

  const handleRemoveComment = useCallback(
    (itemId: string) => {
      dispatch({ type: 'SET_COMMENT', itemId, comment: undefined });
    },
    [dispatch]
  );

  const handleCostAdjust = useCallback(
    (itemId: string, delta: number) => {
      const item = items.find((i) => i.id === itemId);
      const current = item?.costAdjustment ?? 0;
      const newAdj = current + delta;
      // 整数のみ、-10〜10 の範囲にクランプ
      const clamped = Math.max(-10, Math.min(10, Math.round(newAdj)));
      dispatch({ type: 'SET_COST_ADJUSTMENT', itemId, adjustment: clamped });
    },
    [items, dispatch]
  );

  const handleSetTarget = useCallback(
    (itemId: string, targetSlotIndex: number | undefined) => {
      dispatch({ type: 'SET_TARGET', itemId, targetSlotIndex });
    },
    [dispatch]
  );

  const handleToggleTimeDisplay = useCallback(
    (itemId: string) => {
      dispatch({ type: 'TOGGLE_TIME_DISPLAY', itemId });
    },
    [dispatch]
  );

  // Listen for drag end to clear dragInfo indicator
  const handleMouseUp = useCallback(() => {
    setDragInfo(null);
  }, []);

  // Arrow mode handlers
  const handleArrowDragStart = useCallback((itemId: string) => {
    setArrowDragFrom(itemId);
  }, []);

  const handleRemoveArrow = useCallback(
    (arrowId: string) => {
      dispatch({ type: 'REMOVE_ARROW', arrowId });
    },
    [dispatch]
  );

  // Window-level mouse events for arrow dragging
  useEffect(() => {
    if (!arrowDragFrom) return;

    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (e: MouseEvent) => {
      const layersEl = container.querySelector('.timeline-layers');
      if (!layersEl) return;
      const rect = layersEl.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const y = e.clientY - rect.top;
      setArrowDragMouse({ x, y });
    };

    const onMouseUp = (e: MouseEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const itemEl = target?.closest('[data-item-id]');
      const toItemId = itemEl?.getAttribute('data-item-id');

      if (toItemId && toItemId !== arrowDragFrom) {
        dispatch({
          type: 'ADD_ARROW',
          arrow: {
            id: `arrow-${nextArrowId++}`,
            fromItemId: arrowDragFrom,
            toItemId,
          },
        });
      }

      setArrowDragFrom(null);
      setArrowDragMouse(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [arrowDragFrom, dispatch]);

  // Compute arrow preview line
  const arrowPreviewLine = (() => {
    if (!arrowDragFrom || !arrowDragMouse) return null;
    const fromItem = items.find((i) => i.id === arrowDragFrom);
    if (!fromItem) return null;
    const fromXOffset = itemXOffsetMap.get(arrowDragFrom) ?? 0;
    const fromX = totalWidth - TIMELINE_PAD_RIGHT - (fromItem.timeMs / 1000) * zoomLevel + fromXOffset;
    const fromY = fromItem.layerIndex * LAYER_HEIGHT + LAYER_HEIGHT / 2;
    return { fromX, fromY, toX: arrowDragMouse.x, toY: arrowDragMouse.y };
  })();

  const layerAreaTop = RULER_HEIGHT + COST_RULER_HEIGHT;
  const layerAreaBottom = RULER_HEIGHT + COST_RULER_HEIGHT + layers * LAYER_HEIGHT;

  // ドラッグ中のコスト値を取得
  const dragCostValue = dragInfo ? itemCostMap.get(dragInfo.itemId)?.cost : undefined;

  // 目標時間のX座標
  const targetLineX = targetTimeMs !== undefined
    ? totalWidth - TIMELINE_PAD_RIGHT - (targetTimeMs / 1000) * zoomLevel
    : null;

  return (
    <div className="timeline-wrapper">
      <div className="timeline-controls">
        <span className="timeline-control">
          時間:
          {TIME_PRESETS.map((p) => (
            <button
              key={p.ms}
              className={`preset-btn${totalTimeMs === p.ms ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_TOTAL_TIME', totalTimeMs: p.ms })}
            >
              {p.label}
            </button>
          ))}
          <input
            className="custom-time-input"
            type="text"
            placeholder="M:SS"
            value={customTimeInput}
            onChange={(e) => setCustomTimeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const m = customTimeInput.match(/^(\d+):(\d{1,2})$/);
              if (!m) return;
              const ms = (Number(m[1]) * 60 + Number(m[2])) * 1000;
              if (ms > 0 && ms <= MAX_TOTAL_TIME_MS) {
                dispatch({ type: 'SET_TOTAL_TIME', totalTimeMs: ms });
                setCustomTimeInput('');
              }
            }}
            title="自由入力（例: 4:30）Enterで確定（最大4:30）"
          />
        </span>
        <span className="timeline-control">
          スナップ:
          <button
            className={`preset-btn${snapMode === '1s' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_SNAP_MODE', snapMode: snapMode === '1s' ? '0.1s' : '1s' })}
          >
            {snapMode === '1s' ? '1秒' : '0.1秒'}
          </button>
        </span>
        <label className="timeline-control">
          レイヤー:
          <select
            value={layers}
            onChange={(e) => {
              const newLayers = Number(e.target.value);
              if (newLayers < layers) {
                const removedItems = items.filter((item) => item.layerIndex >= newLayers);
                if (removedItems.length > 0) {
                  if (!window.confirm(`レイヤー${newLayers + 1}以降にスキルが${removedItems.length}個配置されています。削除しますか？`)) {
                    return;
                  }
                }
              }
              dispatch({ type: 'SET_LAYERS', layers: newLayers });
            }}
          >
            {Array.from({ length: MAX_LAYERS }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <span className="timeline-control">
          目標:
          <input
            className="custom-time-input"
            type="text"
            placeholder="M:SS"
            value={targetTimeInput}
            onChange={(e) => setTargetTimeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const val = targetTimeInput.trim();
              if (!val) {
                dispatch({ type: 'SET_TARGET_TIME', targetTimeMs: undefined });
                setTargetTimeInput('');
                return;
              }
              const m = val.match(/^(\d+):(\d{1,2})$/);
              if (!m) return;
              const ms = (Number(m[1]) * 60 + Number(m[2])) * 1000;
              if (ms >= 0 && ms <= totalTimeMs) {
                dispatch({ type: 'SET_TARGET_TIME', targetTimeMs: ms });
                setTargetTimeInput('');
              }
            }}
            title="目標時間を入力（例: 1:30）Enterで確定、空欄で削除"
          />
          {targetTimeMs !== undefined && (
            <button
              className="preset-btn"
              onClick={() => {
                dispatch({ type: 'SET_TARGET_TIME', targetTimeMs: undefined });
                setTargetTimeInput('');
              }}
              title="目標時間を削除"
            >
              解除
            </button>
          )}
        </span>
      </div>
      <div className="timeline-nav-wrapper">
        <button
          className="timeline-nav-btn timeline-nav-left"
          onClick={() => scrollByStep('left')}
          title="30秒前へ（大きい時間方向）"
        >
          ◀
        </button>
        <div
          ref={containerRef}
          className="timeline-scroll"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setCursorVisible(false)}
          onMouseUp={handleMouseUp}
        >
        <div className="timeline-content" style={{ width: totalWidth }}>
          <TimelineRuler zoomLevel={zoomLevel} snapMode={snapMode} totalTimeS={totalTimeS} />
          <CostRuler
            slots={slots}
            items={items}
            slotCostConfigs={slotCostConfigs}
            totalTimeMs={totalTimeMs}
            zoomLevel={zoomLevel}
            totalWidth={totalWidth}
            heavyArmorCount={state.heavyArmorCount}
            redWinterCount={state.redWinterCount}
          />
          <BubbleLayer
            items={items}
            slots={slots}
            zoomLevel={zoomLevel}
            totalWidth={totalWidth}
            onRemoveComment={handleRemoveComment}
          />
          <div className="timeline-layers">
            {Array.from({ length: layers }, (_, i) => (
              <TimelineLayer
                key={i}
                layerIndex={i}
                items={items.filter((item) => item.layerIndex === i)}
                allItems={items}
                slots={slots}
                zoomLevel={zoomLevel}
                snapMode={snapMode}
                totalWidth={totalWidth}
                totalTimeMs={totalTimeMs}
                totalLayers={layers}
                onDrop={handleDrop}
                onMoveItem={handleMoveItem}
                onRemoveItem={handleRemoveItem}
                onDoubleClickItem={handleDoubleClickItem}
                onItemDragStart={handleItemDragStart}
                onItemDragEnd={handleItemDragEnd}
                zoomLevelRef={zoomRef}
                snapModeRef={snapRef}
                arrowMode={arrowMode}
                onArrowDragStart={handleArrowDragStart}
                itemCostMap={itemCostMap}
                onCostAdjust={handleCostAdjust}
                onSetTarget={handleSetTarget}
                onToggleTimeDisplay={handleToggleTimeDisplay}
              />
            ))}
            <ArrowLayer
              arrows={arrows}
              items={items}
              zoomLevel={zoomLevel}
              totalWidth={totalWidth}
              totalHeight={layers * LAYER_HEIGHT}
              itemXOffsetMap={itemXOffsetMap}
              previewLine={arrowPreviewLine}
              onRemoveArrow={handleRemoveArrow}
            />
          </div>
          <TimelineCursor
            x={cursorX}
            timeMs={cursorTimeMs}
            visible={cursorVisible}
            layerTop={layerAreaTop}
            layerBottom={layerAreaBottom}
          />
          {/* 目標時間の赤い縦線 */}
          {targetLineX !== null && (
            <>
              <div
                className="timeline-target-line"
                style={{
                  left: targetLineX,
                  top: layerAreaTop,
                  height: layerAreaBottom - layerAreaTop,
                }}
              />
              <div
                className="timeline-target-label"
                style={{ left: targetLineX }}
              >
                {Math.floor(targetTimeMs! / 60000)}:{String(Math.floor((targetTimeMs! % 60000) / 1000)).padStart(2, '0')}
              </div>
            </>
          )}
        </div>
        </div>
        <button
          className="timeline-nav-btn timeline-nav-right"
          onClick={() => scrollByStep('right')}
          title="30秒先へ（小さい時間方向）"
        >
          ▶
        </button>
      </div>
      {/* ドラッグ中の時間+コスト表示（右上固定） */}
      {dragInfo !== null && (
        <div className="timeline-drag-time">
          <div className="timeline-drag-time-main">
            {Math.floor(dragInfo.timeMs / 60000)}:
            {String(Math.floor((dragInfo.timeMs % 60000) / 1000)).padStart(2, '0')}.
            {String(dragInfo.timeMs % 1000).padStart(3, '0')}
          </div>
          {dragCostValue !== undefined && (
            <div className="timeline-drag-time-cost">
              Cost: {costToDisplay(dragCostValue)}
            </div>
          )}
        </div>
      )}
      {editingCommentId !== null && (
        <div className="comment-modal-overlay" onClick={() => setEditingCommentId(null)}>
          <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comment-modal-title">コメントを入力</div>
            <input
              className="comment-modal-input"
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommentSubmit();
                if (e.key === 'Escape') setEditingCommentId(null);
              }}
              autoFocus
              placeholder="コメント（空欄で削除）"
              maxLength={30}
            />
            <div className="comment-modal-actions">
              <button className="comment-modal-btn ok" onClick={handleCommentSubmit}>
                OK
              </button>
              <button className="comment-modal-btn cancel" onClick={() => setEditingCommentId(null)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
