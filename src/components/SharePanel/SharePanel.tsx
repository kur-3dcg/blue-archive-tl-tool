import { useState, useRef } from 'react';
import type { TimelineState, CharacterSlot } from '../../types';
import { encode } from '../../utils/shareCodec';
import type { ShareData } from '../../utils/shareCodec';
import { generateTlText } from '../../utils/tlExport';
import { generateTlImage } from '../../utils/tlImageExport';
import './SharePanel.css';

interface Props {
  state: TimelineState;
  onCoreAction?: () => void;
}

/**
 * ShareDataからLOAD_STATE用のstateを構築する
 */
export function buildLoadState(
  data: ShareData,
  currentSlots: CharacterSlot[],
  currentTotalTimeMs: number
) {
  const slots = currentSlots.map((s) => {
    const found = data.slots.find(
      (ds) => ds.type === s.type && ds.index === s.index
    );
    return found
      ? { ...s, character: { name: found.name, image: found.image } }
      : { ...s, character: null };
  });

  const items = data.items.map((di, i) => ({
    id: `imported-${Date.now()}-${i}`,
    slotIndex: di.slotIndex,
    timeMs: di.timeMs,
    layerIndex: di.layerIndex,
    ...(di.comment ? { comment: di.comment } : {}),
    ...(di.costAdjustment ? { costAdjustment: di.costAdjustment } : {}),
    ...(di.targetSlotIndex !== undefined ? { targetSlotIndex: di.targetSlotIndex } : {}),
    ...(di.targetEtcIcon ? { targetEtcIcon: di.targetEtcIcon } : {}),
    ...(di.useTimeDisplay ? { useTimeDisplay: true } : {}),
  }));

  const arrows = (data.arrows ?? [])
    .filter((a) => a.fromIndex < items.length && a.toIndex < items.length)
    .map((a, i) => ({
      id: `imported-arrow-${Date.now()}-${i}`,
      fromItemId: items[a.fromIndex].id,
      toItemId: items[a.toIndex].id,
    }));

  const standaloneComments = data.standaloneComments?.map((sc, i) => ({
    id: `imported-sc-${Date.now()}-${i}`,
    timeMs: sc.timeMs,
    text: sc.text,
  }));

  const stageGimmicks = data.stageGimmicks?.map((g, i) => ({
    id: `imported-gimmick-${Date.now()}-${i}`,
    timeMs: g.timeMs,
    durationMs: g.durationMs,
    recoveryDelta: g.recoveryDelta,
    label: g.label,
  }));

  return {
    slots,
    items,
    arrows,
    layers: data.layers,
    totalTimeMs: data.totalTimeMs ?? currentTotalTimeMs,
    slotCostConfigs: data.slotCostConfigs,
    targetTimeMs: data.targetTimeMs,
    standaloneComments,
    stageGimmicks,
  };
}

export function SharePanel({ state, onCoreAction }: Props) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fireToast = (message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
    timerRef.current = setTimeout(() => setToast(null), 2000);
  };

  const doEncode = async () => {
    return encode(
      state.slots, state.items, state.layers, state.totalTimeMs,
      state.arrows, state.slotCostConfigs, state.targetTimeMs,
      state.standaloneComments, state.stageGimmicks,
    );
  };

  const handleExportUrl = async () => {
    setLoading(true);
    try {
      const result = await doEncode();
      const url = `${window.location.origin}${window.location.pathname}#${result}`;
      setError('');
      await navigator.clipboard.writeText(url);
      fireToast('URLをコピーしました');
      onCoreAction?.();
    } catch {
      setError('エクスポートに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleExportTl = async () => {
    try {
      const text = generateTlText(state);
      await navigator.clipboard.writeText(text);
      fireToast('TLテキストをコピーしました');
      onCoreAction?.();
    } catch {
      setError('TLテキストのコピーに失敗しました');
    }
  };

  const handleExportImage = async (transparent: boolean) => {
    try {
      const blob = await generateTlImage(state, { transparent });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'timeline.png';
      a.click();
      URL.revokeObjectURL(url);
      fireToast('画像を保存しました');
      onCoreAction?.();
    } catch {
      setError('画像出力に失敗しました');
    }
  };

  return (
    <div className="share-panel">
      <div className="share-panel-title">共有:</div>
      <div className="share-panel-row">
        <button className="share-btn export" onClick={handleExportUrl} disabled={loading} title="URLをクリップボードにコピー（Twitter等で共有）">
          {loading ? '...' : 'URL出力'}
        </button>
        <button className="share-btn export-tl" onClick={handleExportTl} title="TLをTSV形式でクリップボードにコピー">
          TL出力
        </button>
        <button className="share-btn export-image" onClick={() => handleExportImage(true)} title="TLを画像（PNG透過）として保存">
          画像出力（透過）
        </button>
        <button className="share-btn export-image" onClick={() => handleExportImage(false)} title="TLを画像（PNG白背景）として保存">
          画像出力（白）
        </button>
      </div>
      {error && <div className="share-panel-error">{error}</div>}
      {toast && (
        <div key={toast.id} className="toast-popup">
          {toast.message}
        </div>
      )}
    </div>
  );
}
