import { useState } from 'react';
import type { TimelineState, TimelineAction, CharacterSlot } from '../../types';
import { encode, decode } from '../../utils/shareCodec';
import type { ShareData } from '../../utils/shareCodec';
import './SharePanel.css';

interface Props {
  state: TimelineState;
  dispatch: React.Dispatch<TimelineAction>;
}

/**
 * 共有コードからURLハッシュ部分を抽出する。
 * URLの場合は # 以降を返す。それ以外はそのまま返す。
 */
function extractCode(input: string): string {
  const trimmed = input.trim();
  // URL形式: https://...#Z:xxx or https://...#xxx
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx !== -1 && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
    return trimmed.slice(hashIdx + 1);
  }
  return trimmed;
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
    ...(di.useTimeDisplay ? { useTimeDisplay: true } : {}),
  }));

  const arrows = (data.arrows ?? [])
    .filter((a) => a.fromIndex < items.length && a.toIndex < items.length)
    .map((a, i) => ({
      id: `imported-arrow-${Date.now()}-${i}`,
      fromItemId: items[a.fromIndex].id,
      toItemId: items[a.toIndex].id,
    }));

  return {
    slots,
    items,
    arrows,
    layers: data.layers,
    totalTimeMs: data.totalTimeMs ?? currentTotalTimeMs,
    slotCostConfigs: data.slotCostConfigs,
    targetTimeMs: data.targetTimeMs,
    heavyArmorCount: data.heavyArmorCount,
    redWinterCount: data.redWinterCount,
  };
}

export function SharePanel({ state, dispatch }: Props) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<'url' | 'code' | false>(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const doEncode = async () => {
    return encode(
      state.slots, state.items, state.layers, state.totalTimeMs,
      state.arrows, state.slotCostConfigs, state.targetTimeMs,
      state.heavyArmorCount, state.redWinterCount
    );
  };

  // URL共有: ハッシュ付きURLをクリップボードにコピー
  const handleExportUrl = async () => {
    setLoading(true);
    try {
      const result = await doEncode();
      const url = `${window.location.origin}${window.location.pathname}#${result}`;
      setCode(result);
      setError('');
      await navigator.clipboard.writeText(url);
      setCopied('url');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('エクスポートに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // コード共有: 生コードをクリップボードにコピー
  const handleExportCode = async () => {
    setLoading(true);
    try {
      const result = await doEncode();
      setCode(result);
      setError('');
      await navigator.clipboard.writeText(result);
      setCopied('code');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('エクスポートに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setError('');
    setLoading(true);
    try {
      const extracted = extractCode(code);
      const data = await decode(extracted);
      if (!data) {
        setError('無効なコードです');
        setLoading(false);
        return;
      }

      dispatch({
        type: 'LOAD_STATE',
        state: buildLoadState(data, state.slots, state.totalTimeMs),
      });
      setError('');
    } catch {
      setError('無効なコードです');
    } finally {
      setLoading(false);
    }
  };

  const copiedLabel = copied === 'url' ? 'URL copied!' : copied === 'code' ? 'コピー済!' : '';

  return (
    <div className="share-panel">
      <div className="share-panel-title">共有:</div>
      <input
        className="share-panel-textarea"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="コードまたはURLを貼り付け"
      />
      <div className="share-panel-row">
        <button className="share-btn export" onClick={handleExportUrl} disabled={loading} title="URLをクリップボードにコピー（Twitter等で共有）">
          {loading ? '...' : copiedLabel || 'URL'}
        </button>
        <button className="share-btn export-code" onClick={handleExportCode} disabled={loading} title="コードをクリップボードにコピー">
          {loading ? '...' : 'Code'}
        </button>
        <button className="share-btn import" onClick={handleImport} disabled={loading}>
          {loading ? '...' : 'Import'}
        </button>
      </div>
      {error && <div className="share-panel-error">{error}</div>}
    </div>
  );
}
