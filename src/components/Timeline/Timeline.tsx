import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { TimelineState, TimelineAction, SnapMode, EtcIcon } from '../../types';
import etcData from '../../../data/etc.json';
import { RULER_HEIGHT, LAYER_HEIGHT, ITEM_WIDTH, TIMELINE_PAD_LEFT, TIMELINE_PAD_RIGHT, VIEWPORT_DURATION_S, STANDALONE_COMMENT_HEIGHT } from '../../constants';
import { TimelineRuler } from './TimelineRuler';
import { TimelineLayer } from './TimelineLayer';
import { TimelineCursor } from './TimelineCursor';
import { BubbleLayer } from './BubbleLayer';
import { StandaloneCommentLayer } from './StandaloneCommentLayer';
import { ArrowLayer } from './ArrowLayer';
import { CostRuler, COST_RULER_HEIGHT } from './CostRuler';
import { NSLayerSection } from './NSLayerSection';
import { snapTime, snapToNearestItem } from '../../utils/snap';
import { calculateItemCosts, computeArmorCounts, findCostSufficientTimeMs, findCostMaxReachedTimeMs, calculateCostCap } from '../../utils/costCalc';
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
  locked: boolean;
  queueValidation: boolean;
  showNsLayers: boolean;
  costSnap: boolean;
}


export function Timeline({ state, dispatch, arrowMode, pendingSlotIndex, onClearPendingSlot, locked, queueValidation, showNsLayers, costSnap }: Props) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);
  const [cursorTimeMs, setCursorTimeMs] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [dragInfo, setDragInfo] = useState<{ timeMs: number; itemId: string } | null>(null);
  const [isNsDragging, setIsNsDragging] = useState(false);
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

  // 重装甲・RW人数（コスト計算・コストスナップで共用）
  const { heavyArmorCount, redWinterCount } = useMemo(() => computeArmorCounts(slots), [slots]);

  // Calculate cost for each item
  const itemCostMap = useMemo(() => {
    return calculateItemCosts(slots, items, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks);
  }, [slots, items, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks]);

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

      const yInContent = e.clientY - rect.top + container.scrollTop;
      setCursorX(xInContent);
      setCursorY(yInContent);
      setCursorTimeMs(snapTime(clampedTime, snapMode));
      setCursorVisible(true);
    },
    [totalWidth, zoomLevel, snapMode, totalTimeMs]
  );

  const handleDrop = useCallback(
    (slotIndex: number, timeMs: number, layerIndex: number) => {
      if (!slots[slotIndex]?.character) return;
      const activeSkillIndex = slotCostConfigs[slotIndex]?.activeSkillIndex ?? 0;
      let finalTimeMs = timeMs;
      if (costSnap) {
        const base = slotCostConfigs[slotIndex]?.skillCosts?.[activeSkillIndex]
          ?? slotCostConfigs[slotIndex]?.skillCost ?? 3;
        const exCost = Math.max(0, Math.min(10, base));
        // EXスナップ（コスト不足時に充足時刻へ）
        finalTimeMs = findCostSufficientTimeMs(
          timeMs, exCost, slots, items, slotCostConfigs,
          totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks
        );
        // MAXスナップ（EXスナップが不要 & コストMAX中ならMAX到達時刻へ）
        if (finalTimeMs === timeMs) {
          const cap = calculateCostCap(slotCostConfigs, slots);
          finalTimeMs = findCostMaxReachedTimeMs(
            timeMs, cap, slots, items, slotCostConfigs,
            totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks
          );
        }
      }
      dispatch({
        type: 'ADD_ITEM',
        item: {
          id: crypto.randomUUID(),
          slotIndex,
          timeMs: finalTimeMs,
          layerIndex,
          ...(activeSkillIndex > 0 ? { skillIndex: activeSkillIndex } : {}),
        },
      });
    },
    [slots, slotCostConfigs, dispatch, costSnap, items, totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks]
  );

  const handleMoveItem = useCallback(
    (itemId: string, timeMs: number, layerIndex?: number) => {
      let finalTimeMs = timeMs;
      if (costSnap) {
        const item = items.find((it) => it.id === itemId);
        if (item) {
          const skillIdx = item.skillIndex ?? 0;
          const config = slotCostConfigs[item.slotIndex];
          const base = config?.skillCosts?.[skillIdx] ?? config?.skillCost ?? 3;
          const exCost = Math.max(0, Math.min(10, base + (item.costAdjustment ?? 0)));
          // EXスナップ
          finalTimeMs = findCostSufficientTimeMs(
            timeMs, exCost, slots, items, slotCostConfigs,
            totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks, itemId
          );
          // MAXスナップ（EXスナップが不要 & コストMAX中ならMAX到達時刻へ）
          if (finalTimeMs === timeMs) {
            const cap = calculateCostCap(slotCostConfigs, slots);
            finalTimeMs = findCostMaxReachedTimeMs(
              timeMs, cap, slots, items, slotCostConfigs,
              totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks, itemId
            );
          }
        }
      }
      dispatch({ type: 'MOVE_ITEM', itemId, timeMs: finalTimeMs, layerIndex });
      setDragInfo({ timeMs: finalTimeMs, itemId });
    },
    [dispatch, costSnap, items, slots, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks]
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      dispatch({ type: 'REMOVE_ITEM', itemId });
    },
    [dispatch]
  );

  // ── コンテキストメニュー ──
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [contextMenu]);

  const handleContextMenuItem = useCallback(
    (itemId: string, x: number, y: number) => setContextMenu({ x, y, itemId }),
    []
  );

  const handleRemoveLayerItems = useCallback(
    (layerIndex: number) => {
      setContextMenu(null);
      dispatch({ type: 'REMOVE_LAYER_ITEMS', layerIndex });
    },
    [dispatch]
  );

  const handleRemoveSlotItems = useCallback(
    (slotIndex: number) => {
      setContextMenu(null);
      dispatch({ type: 'REMOVE_SLOT_ITEMS', slotIndex });
    },
    [dispatch]
  );

  // バフ終了チェーン: 元アイテムのバフ持続時間ごとに同スロット・同レイヤーへ連鎖配置
  const handleChainBuff = useCallback(
    (itemId: string) => {
      setContextMenu(null);
      const item = items.find((it) => it.id === itemId);
      if (!item) return;
      const char = slots[item.slotIndex]?.character;
      if (!char) return;

      const skillIndex = item.skillIndex ?? 0;
      const rawDuration =
        (char.skills?.[skillIndex]?.exDuration ?? char.exDuration) ?? null;
      if (typeof rawDuration !== 'number' || rawDuration <= 0) return;

      // 固有2/4によるバフ時間倍率（BuffBarLayer と同じ計算）
      const config = slotCostConfigs[item.slotIndex];
      const hasU2 = config?.hasUniqueWeapon2 || config?.hasUniqueWeapon4;
      const mult = char.hasDurationBuff && hasU2 ? 1.19 : 1;
      const stepMs = Math.round(rawDuration * mult * 1000);

      // 戦闘開始方向（timeMs=totalTimeMs）に達するまでチェーン
      const chainTimes: number[] = [];
      let cur = item.timeMs;
      while (true) {
        const next = cur - stepMs;
        if (next <= 0) break;
        chainTimes.push(next);
        cur = next;
      }
      if (chainTimes.length === 0) return;

      // 既存アイテムとの重なりチェック（同レイヤー・500ms 以内）
      const OVERLAP_MS = 500;
      const conflicts = chainTimes.filter((t) =>
        items.some(
          (it) => it.layerIndex === item.layerIndex && Math.abs(it.timeMs - t) < OVERLAP_MS
        )
      );
      if (conflicts.length > 0) {
        if (
          !window.confirm(
            `${conflicts.length}箇所で既存のスキルと重なります。続けますか？`
          )
        )
          return;
      }

      for (const timeMs of chainTimes) {
        dispatch({
          type: 'ADD_ITEM',
          item: {
            id: crypto.randomUUID(),
            slotIndex: item.slotIndex,
            timeMs,
            layerIndex: item.layerIndex,
            ...(skillIndex > 0 ? { skillIndex } : {}),
          },
        });
      }
    },
    [items, slots, slotCostConfigs, dispatch]
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
                onContextMenuItem={handleContextMenuItem}
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
          {/* NSレイヤーセクション */}
          {showNsLayers && (
            <NSLayerSection
              slots={slots}
              totalWidth={totalWidth}
              totalTimeMs={state.totalTimeMs}
              zoomLevel={zoomLevel}
              nsBarOffsets={state.nsBarOffsets}
              nsConditionalTicks={state.nsConditionalTicks}
              onAdjustNsBar={(slotIndex, barIndex, deltaMs) =>
                dispatch({ type: 'ADJUST_NS_BAR', slotIndex, barIndex, deltaMs })
              }
              onResetNsBar={(slotIndex, fromBarIndex) =>
                dispatch({ type: 'RESET_NS_BAR', slotIndex, fromBarIndex })
              }
              onAddNsConditionalTick={(slotIndex, timeMs) =>
                dispatch({ type: 'ADD_NS_CONDITIONAL_TICK', slotIndex, timeMs })
              }
              onMoveNsConditionalTick={(slotIndex, tickIndex, newTimeMs) =>
                dispatch({ type: 'MOVE_NS_CONDITIONAL_TICK', slotIndex, tickIndex, newTimeMs })
              }
              onRemoveNsConditionalTick={(slotIndex, tickIndex) =>
                dispatch({ type: 'REMOVE_NS_CONDITIONAL_TICK', slotIndex, tickIndex })
              }
              onDragChange={setIsNsDragging}
              nsSnapMode={state.snapMode}
            />
          )}
          <TimelineCursor
            x={cursorX}
            timeMs={cursorTimeMs}
            visible={cursorVisible}
            layerTop={layerAreaTop}
            layerBottom={layerAreaBottom}
            dragY={(dragInfo !== null || isNsDragging) ? cursorY : undefined}
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
      {/* 右クリックコンテキストメニュー */}
      {contextMenu !== null && (() => {
        const ctxItem = items.find((it) => it.id === contextMenu.itemId);
        const ctxChar = ctxItem ? slots[ctxItem.slotIndex]?.character : null;
        const ctxSkillIdx = ctxItem?.skillIndex ?? 0;
        const ctxRawDur =
          ctxChar?.skills?.[ctxSkillIdx]?.exDuration ?? ctxChar?.exDuration ?? null;
        const canChain = typeof ctxRawDur === 'number' && ctxRawDur > 0;
        const sameLayerCount = ctxItem ? items.filter((it) => it.layerIndex === ctxItem.layerIndex).length : 0;
        const sameSlotCount = ctxItem ? items.filter((it) => it.slotIndex === ctxItem.slotIndex).length : 0;
        return (
          <div
            className="timeline-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="timeline-context-menu-item danger"
              onClick={() => { setContextMenu(null); handleRemoveItem(contextMenu.itemId); }}
            >
              削除
            </button>
            {canChain && (
              <button
                className="timeline-context-menu-item"
                onClick={() => handleChainBuff(contextMenu.itemId)}
              >
                バフ終了にチェーン
              </button>
            )}
            {ctxItem && sameLayerCount > 1 && (
              <button
                className="timeline-context-menu-item danger"
                onClick={() => handleRemoveLayerItems(ctxItem.layerIndex)}
              >
                同レイヤーの全削除（{sameLayerCount}個）
              </button>
            )}
            {ctxItem && sameSlotCount > 1 && (
              <button
                className="timeline-context-menu-item danger"
                onClick={() => handleRemoveSlotItems(ctxItem.slotIndex)}
              >
                同キャラEXの全削除（{sameSlotCount}個）
              </button>
            )}
          </div>
        );
      })()}
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
