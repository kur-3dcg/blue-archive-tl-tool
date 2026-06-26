import { useState, useRef, useEffect } from 'react';
import type { TimelineState, CharacterSlot } from '../../types';
import { encode, decode } from '../../utils/shareCodec';
import type { ShareData } from '../../utils/shareCodec';
import { generateTlText } from '../../utils/tlExport';
import { generateTlImage } from '../../utils/tlImageExport';
import { generateTlImagePaged } from '../../utils/tlImageExportPaged';
import { parseTlText } from '../../utils/tlTextImport';
import type { TlImportResult } from '../../utils/tlTextImport';
import { useT } from '../../i18n';
import './SharePanel.css';

interface Props {
  state: TimelineState;
  onCoreAction?: () => void;
  onImport?: (data: ShareData) => void;
  onImportText?: (result: TlImportResult) => void;
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
    ...(di.skillIndex ? { skillIndex: di.skillIndex } : {}),
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
    mode: (data.mode as 'normal' | 'extended' | undefined) ?? 'normal',
    slotCostConfigs: data.slotCostConfigs,
    targetTimeMs: data.targetTimeMs,
    standaloneComments,
    stageGimmicks,
    skillQueueOrder: data.skillQueueOrder,
  };
}

export function SharePanel({ state, onCoreAction, onImport, onImportText }: Props) {
  const t = useT();
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTlImportModal, setShowTlImportModal] = useState(false);
  const [tlImportText, setTlImportText] = useState('');
  const [tlImportResult, setTlImportResult] = useState<TlImportResult | null>(null);
  const tlImportTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursorRef = useRef<number | null>(null);

  // Tab挿入後にカーソル位置を復元
  useEffect(() => {
    if (pendingCursorRef.current !== null && tlImportTextareaRef.current) {
      tlImportTextareaRef.current.selectionStart = pendingCursorRef.current;
      tlImportTextareaRef.current.selectionEnd = pendingCursorRef.current;
      pendingCursorRef.current = null;
    }
  }, [tlImportText]);

  const fireToast = (message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
    timerRef.current = setTimeout(() => setToast(null), 2000);
  };

  const doEncode = async () => {
    return encode(
      state.slots, state.items, state.layers, state.totalTimeMs,
      state.arrows, state.slotCostConfigs, state.targetTimeMs,
      state.standaloneComments, state.stageGimmicks, state.skillQueueOrder,
      state.mode,
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

  const handleExportImagePaged = async () => {
    try {
      const blob = await generateTlImagePaged(state, { rowsPerPage });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'timeline-pages.zip';
      a.click();
      URL.revokeObjectURL(url);
      fireToast('ZIPを保存しました');
      onCoreAction?.();
    } catch {
      setError('分割画像出力に失敗しました');
    }
  };

  const handleExportJson = async () => {
    setLoading(true);
    try {
      const code = await doEncode();
      const json = JSON.stringify({ version: 1, code }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'timeline.json';
      a.click();
      URL.revokeObjectURL(url);
      setError('');
      fireToast('JSONファイルを保存しました');
      onCoreAction?.();
    } catch {
      setError('JSON保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTlImportModal = () => {
    setTlImportText('');
    setTlImportResult(null);
    setShowTlImportModal(true);
  };

  const handleTlImportTextChange = (text: string) => {
    setTlImportText(text);
    if (text.trim()) {
      setTlImportResult(parseTlText(text));
    } else {
      setTlImportResult(null);
    }
  };

  const handleTlImportKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newValue = el.value.substring(0, start) + '\t' + el.value.substring(end);
      pendingCursorRef.current = start + 1;
      handleTlImportTextChange(newValue);
    }
  };

  const handleConfirmTlImport = () => {
    if (!tlImportResult) return;
    onImportText?.(tlImportResult);
    setShowTlImportModal(false);
    setTlImportText('');
    setTlImportResult(null);
    fireToast('TLテキストをインポートしました');
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      e.target.value = '';
      const json = JSON.parse(text);
      const code = typeof json.code === 'string' ? json.code : null;
      if (!code) { setError('JSONの形式が正しくありません'); return; }
      const data = await decode(code);
      if (!data) { setError('JSONの読み込みに失敗しました'); return; }
      onImport?.(data);
      setError('');
      fireToast('JSONを読み込みました');
    } catch (err) {
      e.target.value = '';
      setError(`読み込みエラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="share-panel">
      <div className="share-panel-title">{t('共有')}:</div>
      <div className="share-panel-row">
        <button className="share-btn export" onClick={handleExportUrl} disabled={loading} title="URLをクリップボードにコピー（Twitter等で共有）">
          {loading ? '...' : t('URL出力')}
        </button>
        <button className="share-btn export-tl" onClick={handleExportTl} title="TLをTSV形式でクリップボードにコピー">
          {t('TL出力')}
        </button>
        <button className="share-btn export-image" onClick={() => handleExportImage(true)} title="TLを画像（PNG透過）として保存">
          {t('画像出力（透過）')}
        </button>
        <button className="share-btn export-image" onClick={() => handleExportImage(false)} title="TLを画像（PNG白背景）として保存">
          {t('画像出力（白）')}
        </button>
      </div>
      <div className="share-panel-row">
        <button className="share-btn export-image" onClick={handleExportImagePaged} title="TLを複数ページのPNG（ZIP）として保存">
          {t('画像出力（分割）')}
        </button>
        <label className="share-rows-label" title="1ページあたりの行数">
          {t('行/ページ')}:
          <input
            type="number"
            className="share-rows-input"
            value={rowsPerPage}
            min={5}
            max={50}
            step={1}
            onChange={(e) => setRowsPerPage(Math.max(5, Math.min(50, Number(e.target.value) || 20)))}
          />
        </label>
      </div>
      <div className="share-panel-row">
        <button className="share-btn export-json" onClick={handleExportJson} disabled={loading} title="現在のTLをJSONファイルとして保存">
          {loading ? '...' : t('JSON保存')}
        </button>
        <button className="share-btn import-json" onClick={() => fileInputRef.current?.click()} title="JSONファイルからTLを読み込む">
          {t('JSONから読込')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportJsonFile}
        />
        <button className="share-btn import-json" onClick={handleOpenTlImportModal} title="TLテキスト（TSV形式）からインポート">
          {t('テキストからインポート')}
        </button>
      </div>
      {error && <div className="share-panel-error">{error}</div>}
      {toast && (
        <div key={toast.id} className="toast-popup">
          {toast.message}
        </div>
      )}
      {showTlImportModal && (
        <div className="tl-import-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowTlImportModal(false); }}>
          <div className="tl-import-modal">
            <h3>テキストからTLをインポート</h3>
            <textarea
              ref={tlImportTextareaRef}
              className="tl-import-textarea"
              placeholder={'TLテキスト（TSV形式）を貼り付けてください\n例:\n4:50\tホシノ\t\n4:45\tチェリノ（ホシノ）\t\n3:30\t\t撃破'}
              value={tlImportText}
              onChange={(e) => handleTlImportTextChange(e.target.value)}
              onKeyDown={handleTlImportKeyDown}
              autoFocus
            />
            {tlImportResult && (
              <div className="tl-import-result">
                {(tlImportResult.detectedSt.length > 0 || tlImportResult.detectedSp.length > 0) && (
                  <>
                    <div>検出キャラ（{tlImportResult.items.length} スキル）:</div>
                    <div className="tl-import-chars">
                      {tlImportResult.detectedSt.map((name) => (
                        <span key={name} className="tl-import-char-badge st">{name}</span>
                      ))}
                      {tlImportResult.detectedSp.map((name) => (
                        <span key={name} className="tl-import-char-badge sp">{name}</span>
                      ))}
                    </div>
                  </>
                )}
                {tlImportResult.warnings.length > 0 && (
                  <div className="tl-import-warnings">
                    {tlImportResult.warnings.map((w, i) => (
                      <div key={i} className="tl-import-warning">⚠ {w}</div>
                    ))}
                  </div>
                )}
                {tlImportResult.detectedSt.length === 0 && tlImportResult.detectedSp.length === 0 && (
                  <div style={{ color: 'var(--error-text)' }}>キャラが検出できませんでした。形式を確認してください。</div>
                )}
              </div>
            )}
            <div className="tl-import-actions">
              <button className="tl-import-btn cancel" onClick={() => setShowTlImportModal(false)}>
                キャンセル
              </button>
              <button
                className="tl-import-btn confirm"
                onClick={handleConfirmTlImport}
                disabled={!tlImportResult || (tlImportResult.detectedSt.length === 0 && tlImportResult.detectedSp.length === 0)}
              >
                インポート
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
