import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { TimelineState, TimelineAction, SnapMode, EtcIcon } from '../../types';
import etcData from '../../../data/etc.json';
import { RULER_HEIGHT, LAYER_HEIGHT, ITEM_WIDTH, MAX_LAYERS, TIME_PRESETS, TIMELINE_PAD_LEFT, TIMELINE_PAD_RIGHT, VIEWPORT_DURATION_S, MAX_TOTAL_TIME_MS, STANDALONE_COMMENT_HEIGHT } from '../../constants';
import { TimelineRuler } from './TimelineRuler';
import { TimelineLayer } from './TimelineLayer';
import { TimelineCursor } from './TimelineCursor';
import { BubbleLayer } from './BubbleLayer';
import { StandaloneCommentLayer } from './StandaloneCommentLayer';
import { ArrowLayer } from './ArrowLayer';
import { CostRuler, COST_RULER_HEIGHT } from './CostRuler';
import { snapTime, snapToNearestItem } from '../../utils/snap';
import { calculateItemCosts, computeArmorCounts } from '../../utils/costCalc';
import { msToDisplay, costToDisplay } from '../../utils/timeFormat';
import { validateSkillQueue, ACTIVE_SLOTS, EXTENDED_ACTIVE_SLOTS } from '../../utils/skillQueueValidator';
import { useT } from '../../i18n';
import './Timeline.css';

interface Props {
  state: TimelineState;
  dispatch: React.Dispatch<TimelineAction>;
  arrowMode: boolean;
  pendingSlotIndex: number | null;
  onClearPendingSlot: () => void;
}


export function Timeline({ state, dispatch, arrowMode, pendingSlotIndex, onClearPendingSlot }: Props) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorX, setCursorX] = useState(0);
  const [cursorTimeMs, setCursorTimeMs] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [dragInfo, setDragInfo] = useState<{ timeMs: number; itemId: string } | null>(null);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [targetTimeInput, setTargetTimeInput] = useState('');
  const [locked, setLocked] = useState(false);
  const [queueValidation, setQueueValidation] = useState(false);
  const [commentModal, setCommentModal] = useState<
    | { kind: 'item'; id: string }
    | { kind: 'sc-new'; timeMs: number }
    | { kind: 'sc-edit'; id: string }
    | null
  >(null);
  const [commentInput, setCommentInput] = useState('');
  const [arrowClickFrom, setArrowClickFrom] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const { snapMode, layers, items, arrows, slots, totalTimeMs, slotCostConfigs, targetTimeMs, standaloneComments, stageGimmicks } = state;
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
      el.scrollBy({ left: e.deltaY, behavior: 'auto' });
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
          if (distance <= ITEM_WIDTH) {
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
    const { heavyArmorCount, redWinterCount } = computeArmorCounts(slots);
    return calculateItemCosts(slots, items, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks);
  }, [slots, items, slotCostConfigs, totalTimeMs, stageGimmicks]);

  // スキルキュー検証
  const queueErrorIds = useMemo(() => {
    if (!queueValidation) return new Set<string>();
    const filledSlotIndices = slots.map((s, i) => s.character ? i : -1).filter(i => i >= 0);
    const activeSlots = state.mode === 'extended' ? EXTENDED_ACTIVE_SLOTS : ACTIVE_SLOTS;
    return validateSkillQueue(items, state.skillQueueOrder, filledSlotIndices, activeSlots);
  }, [queueValidation, items, state.skillQueueOrder, slots, state.mode]);

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
          id: crypto.randomUUID(),
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
      if (!item) return;
      setCommentModal({ kind: 'sc-new', timeMs: item.timeMs });
      setCommentInput('');
    },
    [items]
  );

  const handleCtrlClickItem = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      // 即スタックの子をCtrl+クリックした場合、親（xOffset=0）にコメントを付ける
      let targetId = itemId;
      if ((itemXOffsetMap.get(itemId) ?? 0) > 0) {
        const parent = items.find(
          (it) => it.layerIndex === item.layerIndex && it.timeMs === item.timeMs && (itemXOffsetMap.get(it.id) ?? 0) === 0
        );
        if (parent) targetId = parent.id;
      }
      const targetItem = items.find((i) => i.id === targetId);
      setCommentModal({ kind: 'item', id: targetId });
      setCommentInput(targetItem?.comment ?? '');
    },
    [items, itemXOffsetMap]
  );

  const handleCommentSubmit = useCallback(() => {
    if (commentModal === null) return;
    const trimmed = commentInput.trim();
    if (commentModal.kind === 'item') {
      dispatch({ type: 'SET_COMMENT', itemId: commentModal.id, comment: trimmed || undefined });
    } else if (commentModal.kind === 'sc-new') {
      if (trimmed) {
        dispatch({ type: 'ADD_STANDALONE_COMMENT', id: crypto.randomUUID(), timeMs: commentModal.timeMs, text: trimmed });
      }
    } else if (commentModal.kind === 'sc-edit') {
      if (trimmed) {
        dispatch({ type: 'EDIT_STANDALONE_COMMENT', id: commentModal.id, text: trimmed });
      } else {
        dispatch({ type: 'REMOVE_STANDALONE_COMMENT', id: commentModal.id });
      }
    }
    setCommentModal(null);
    setCommentInput('');
  }, [commentModal, commentInput, dispatch]);

  const handleDropStandaloneComment = useCallback((timeMs: number) => {
    setCommentModal({ kind: 'sc-new', timeMs });
    setCommentInput('');
  }, []);

  // ダブルクリックでのスタンドアロンコメント（pending中は無効）
  const justPlacedRef = useRef(false);
  const handleLayersDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (justPlacedRef.current) return; // pending配置直後はスキップ
      if (pendingSlotIndex !== null) return; // pending中はスキップ
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const xInContent = e.clientX - rect.left + container.scrollLeft;
      const timeMs = ((totalWidth - TIMELINE_PAD_RIGHT - xInContent) / zoomLevel) * 1000;
      const clampedTime = Math.max(0, Math.min(totalTimeMs, timeMs));
      setCommentModal({ kind: 'sc-new', timeMs: snapTime(clampedTime, snapMode) });
      setCommentInput('');
    },
    [pendingSlotIndex, totalWidth, zoomLevel, snapMode, totalTimeMs]
  );

  // pendingSlotIndex が設定された状態でのクリック → アイテムを配置
  const handleLayersClick = useCallback(
    (e: React.MouseEvent) => {
      if (pendingSlotIndex === null) return;
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const xInContent = e.clientX - containerRect.left + container.scrollLeft;
      let timeMs = snapTime(
        Math.max(0, Math.min(totalTimeMs, ((totalWidth - TIMELINE_PAD_RIGHT - xInContent) / zoomRef.current) * 1000)),
        snapRef.current
      );
      // レイヤーインデックスをY座標から算出
      const layersEl = e.currentTarget as HTMLElement;
      const layersRect = layersEl.getBoundingClientRect();
      const yInLayers = e.clientY - layersRect.top;
      const layerIndex = Math.max(0, Math.min(layers - 1, Math.floor(yInLayers / LAYER_HEIGHT)));
      // 近接アイテムへのスナップ
      const layerItems = items.filter(it => it.layerIndex === layerIndex);
      timeMs = snapToNearestItem(timeMs, layerItems, '', zoomRef.current, totalWidth);
      handleDrop(pendingSlotIndex, timeMs, layerIndex);
      onClearPendingSlot();
      justPlacedRef.current = true;
      setTimeout(() => { justPlacedRef.current = false; }, 300);
    },
    [pendingSlotIndex, totalWidth, totalTimeMs, layers, items, handleDrop, onClearPendingSlot]
  );

  const handleMoveStandaloneComment = useCallback((id: string, timeMs: number) => {
    dispatch({ type: 'MOVE_STANDALONE_COMMENT', id, timeMs });
  }, [dispatch]);

  const handleRemoveStandaloneComment = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_STANDALONE_COMMENT', id });
  }, [dispatch]);

  const handleEditStandaloneComment = useCallback((id: string, currentText: string) => {
    setCommentModal({ kind: 'sc-edit', id });
    setCommentInput(currentText);
  }, []);

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

  const handleSetTargetEtc = useCallback(
    (itemId: string, targetEtcIcon: string | undefined) => {
      dispatch({ type: 'SET_TARGET_ETC', itemId, targetEtcIcon });
    },
    [dispatch]
  );

  // showWhen条件に一致するetcIconsを絞り込む
  const etcIcons = useMemo((): EtcIcon[] => {
    const icons = etcData as EtcIcon[];
    return icons.filter(
      (icon) =>
        icon.showWhen === null ||
        slots.some((s) => s.character?.name === icon.showWhen)
    );
  }, [slots]);

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

  // Arrow click handler (used by both arrow mode and Ctrl+Click)
  const handleArrowClick = useCallback((itemId: string) => {
    if (arrowClickFrom === null) {
      setArrowClickFrom(itemId);
    } else {
      if (arrowClickFrom !== itemId) {
        dispatch({
          type: 'ADD_ARROW',
          arrow: {
            id: crypto.randomUUID(),
            fromItemId: arrowClickFrom,
            toItemId: itemId,
          },
        });
      }
      setArrowClickFrom(null);
    }
  }, [arrowClickFrom, dispatch]);

  const handleRemoveArrow = useCallback(
    (arrowId: string) => {
      dispatch({ type: 'REMOVE_ARROW', arrowId });
    },
    [dispatch]
  );

  const layerAreaTop = RULER_HEIGHT + COST_RULER_HEIGHT + STANDALONE_COMMENT_HEIGHT;
  const layerAreaBottom = RULER_HEIGHT + COST_RULER_HEIGHT + STANDALONE_COMMENT_HEIGHT + layers * LAYER_HEIGHT;

  // ドラッグ中のコスト値を取得
  const dragCostValue = dragInfo ? itemCostMap.get(dragInfo.itemId)?.usedCost : undefined;

  // 目標時間のX座標
  const targetLineX = targetTimeMs !== undefined
    ? totalWidth - TIMELINE_PAD_RIGHT - (targetTimeMs / 1000) * zoomLevel
    : null;

  return (
    <div className="timeline-wrapper">
      <div className="timeline-controls">
        <div className="operation-ref">
          <span>{t('クリック: 選択')}</span>
          <span>{t('ダブルクリック: フリーコメント')}</span>
          <span>{t('右クリック: 削除')}</span>
          <span>{t('ドラッグ: 移動')}</span>
          <span>{t('Shift+クリック: EX対象')}</span>
          <span>{t('Ctrl+クリック: コメント')}</span>
          <span>{t('Alt+クリック: 矢印')}</span>
        </div>
        <span className="timeline-control" style={{ marginLeft: 'auto' }}>
          {t('時間')}:
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
              const m = customTimeInput.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
              if (!m) return;
              const ms = (Number(m[1]) * 60 + Number(m[2])) * 1000 + Number((m[3] ?? '').padEnd(3, '0'));
              if (ms > 0 && ms <= MAX_TOTAL_TIME_MS) {
                dispatch({ type: 'SET_TOTAL_TIME', totalTimeMs: ms });
                setCustomTimeInput('');
              }
            }}
            title="自由入力（例: 4:30 / 10:00）Enterで確定（最大10:00）"
          />
        </span>
        <span className="timeline-control">
          {t('スナップ')}:
          <button
            className={`preset-btn${snapMode === '1F' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_SNAP_MODE', snapMode: snapMode === '0.1s' ? '1F' : '0.1s' })}
          >
            {snapMode === '1F' ? '1F' : t('0.1秒')}
          </button>
        </span>
        <span className="timeline-control">
          <button
            className={`preset-btn${locked ? ' active' : ''}`}
            onClick={() => setLocked((v) => !v)}
            title="ONにするとスキルアイコンのドラッグ移動を禁止（クリック操作は可能）"
          >
            {locked ? t('🔒移動禁止') : t('🔓移動可')}
          </button>
        </span>
        <span className="timeline-control">
          <button
            className={`preset-btn${queueValidation ? ' active' : ''}`}
            onClick={() => setQueueValidation((v) => !v)}
            title="スキル順検証：ゲーム内のスキルカード順に合わないアイテムを赤くハイライト"
          >
            {t('スキル順')}
          </button>
        </span>
        <label className="timeline-control">
          {t('レイヤー')}:
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
          {t('目標')}:
          <input
            className="custom-time-input"
            type="text"
            placeholder="M:SS.000"
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
              const m = val.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
              if (!m) return;
              const ms = (Number(m[1]) * 60 + Number(m[2])) * 1000 + Number((m[3] ?? '').padEnd(3, '0'));
              if (ms >= 0 && ms <= totalTimeMs) {
                dispatch({ type: 'SET_TARGET_TIME', targetTimeMs: ms });
                setTargetTimeInput('');
              }
            }}
            title="目標時間を入力（例: 1:30 / 1:30.500）Enterで確定、空欄で削除"
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
              {t('解除')}
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
          className={`timeline-scroll${pendingSlotIndex !== null ? ' pending-placement' : ''}`}
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
            stageGimmicks={stageGimmicks}
          />
          <StandaloneCommentLayer
            comments={standaloneComments}
            zoomLevel={zoomLevel}
            zoomLevelRef={zoomRef}
            totalWidth={totalWidth}
            totalTimeMs={totalTimeMs}
            snapMode={snapMode}
            snapModeRef={snapRef}
            onDrop={handleDropStandaloneComment}
            onMove={handleMoveStandaloneComment}
            onRemove={handleRemoveStandaloneComment}
            onEdit={handleEditStandaloneComment}
          />
          <BubbleLayer
            items={items}
            slots={slots}
            zoomLevel={zoomLevel}
            totalWidth={totalWidth}
            onRemoveComment={handleRemoveComment}
          />
          <div className="timeline-layers" onDoubleClick={handleLayersDoubleClick} onClick={handleLayersClick}>
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
                onCtrlClickItem={handleCtrlClickItem}
                onItemDragStart={handleItemDragStart}
                onItemDragEnd={handleItemDragEnd}
                zoomLevelRef={zoomRef}
                snapModeRef={snapRef}
                arrowMode={arrowMode}
                onArrowClick={handleArrowClick}
                arrowClickFrom={arrowClickFrom}
                itemCostMap={itemCostMap}
                onCostAdjust={handleCostAdjust}
                onSetTarget={handleSetTarget}
                onSetTargetEtc={handleSetTargetEtc}
                onToggleTimeDisplay={handleToggleTimeDisplay}
                onDropStandaloneComment={handleDropStandaloneComment}
                etcIcons={etcIcons}
                slotCostConfigs={slotCostConfigs}
                locked={locked}
                queueErrorIds={queueErrorIds}
              />
            ))}
            <ArrowLayer
              arrows={arrows}
              items={items}
              zoomLevel={zoomLevel}
              totalWidth={totalWidth}
              totalHeight={layers * LAYER_HEIGHT}
              itemXOffsetMap={itemXOffsetMap}
              previewLine={null}
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
          {/* スタンドアロンコメントのティール縦線 */}
          {standaloneComments.map((comment) => {
            const lineX = totalWidth - TIMELINE_PAD_RIGHT - (comment.timeMs / 1000) * zoomLevel;
            return (
              <div key={comment.id}>
                <div
                  className="timeline-marker-line"
                  style={{ left: lineX, top: layerAreaTop, height: layerAreaBottom - layerAreaTop }}
                  title={comment.text}
                />
                {comment.text && (
                  <div className="timeline-marker-label" style={{ left: lineX }}>
                    {comment.text}
                  </div>
                )}
              </div>
            );
          })}
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
            {msToDisplay(dragInfo.timeMs)}
          </div>
          {dragCostValue !== undefined && (
            <div className="timeline-drag-time-cost">
              Cost: {costToDisplay(dragCostValue)}
            </div>
          )}
        </div>
      )}
      {commentModal !== null && (
        <div className="comment-modal-overlay" onClick={() => { setCommentModal(null); setCommentInput(''); }}>
          <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comment-modal-title">{t('コメントを入力')}</div>
            <input
              className="comment-modal-input"
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommentSubmit();
                if (e.key === 'Escape') { setCommentModal(null); setCommentInput(''); }
              }}
              autoFocus
              placeholder={t('コメント（空欄で削除）')}
              maxLength={30}
            />
            <div className="comment-modal-actions">
              <button className="comment-modal-btn ok" onClick={handleCommentSubmit}>
                {t('OK')}
              </button>
              <button className="comment-modal-btn cancel" onClick={() => { setCommentModal(null); setCommentInput(''); }}>
                {t('キャンセル')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
