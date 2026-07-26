import { useState, useEffect, useRef, useMemo } from 'react';
import type { TimelineState, TimelineAction } from '../../types';
import { useT } from '../../i18n';
import bossData from '../../../data/bosses.json';
import './SaveLoadModal.css';

const SAVES_KEY = 'ba-tl-saves';
const SLOTS_PER_PAGE = 30;
const FREE_PAGE_COUNT = 4;
const BOSS_PAGE_COUNT = bossData.length;
const MAX_PAGES = BOSS_PAGE_COUNT + FREE_PAGE_COUNT;
const SLOT_COUNT = SLOTS_PER_PAGE * MAX_PAGES;

interface SaveSlotData {
  name: string;
  savedAt: number;
  state: TimelineState;
  previewChars: Array<{ name: string; image: string } | null>;
  itemCount: number;
  totalTimeMs: number;
}

type SlotArray = (SaveSlotData | null)[];

type OverlayState =
  | { type: 'save-name'; slotIdx: number; defaultName: string }
  | { type: 'confirm-overwrite'; slotIdx: number }
  | { type: 'confirm-load'; slotIdx: number }
  | { type: 'confirm-delete'; slotIdx: number }
  | null;

function loadSlots(): SlotArray {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return Array(SLOT_COUNT).fill(null);
    const parsed = JSON.parse(raw) as SlotArray;
    if (!Array.isArray(parsed)) return Array(SLOT_COUNT).fill(null);
    const filled = [...parsed];
    while (filled.length < SLOT_COUNT) filled.push(null);
    return filled.slice(0, SLOT_COUNT);
  } catch {
    return Array(SLOT_COUNT).fill(null);
  }
}

function saveSlots(slots: SlotArray) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(slots));
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

function formatTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

function buildPreview(state: TimelineState): Pick<SaveSlotData, 'previewChars' | 'itemCount' | 'totalTimeMs'> {
  return {
    previewChars: state.slots.map((s) =>
      s.character ? { name: s.character.name, image: s.character.image } : null
    ),
    itemCount: state.items.length,
    totalTimeMs: state.totalTimeMs,
  };
}

/** ページの表示情報を返す */
function getPageInfo(page: number): { isBoss: true; name: string; image: string } | { isBoss: false; freeNum: number } {
  if (page <= BOSS_PAGE_COUNT) {
    const boss = bossData[page - 1];
    return { isBoss: true, name: boss.name, image: boss.image };
  }
  return { isBoss: false, freeNum: page - BOSS_PAGE_COUNT };
}

interface Props {
  initialMode: 'save' | 'load';
  state: TimelineState;
  dispatch: React.Dispatch<TimelineAction>;
  onClose: () => void;
  onSaved?: () => void;
}

export function SaveLoadModal({ initialMode, state, dispatch, onClose, onSaved }: Props) {
  const t = useT();
  const [slots, setSlots] = useState<SlotArray>(loadSlots);
  const [mode, setMode] = useState<'save' | 'load'>(initialMode);
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [nameInput, setNameInput] = useState('');
  const [page, setPage] = useState(1);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const totalPages = MAX_PAGES;

  const pageSlotIndices = useMemo(() => {
    const start = (page - 1) * SLOTS_PER_PAGE;
    return Array.from({ length: SLOTS_PER_PAGE }, (_, i) => start + i);
  }, [page]);

  useEffect(() => {
    if (overlay?.type === 'save-name') {
      setNameInput(overlay.defaultName);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [overlay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (overlay) setOverlay(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay, onClose]);

  const defaultSaveName = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  };

  const doSave = (slotIdx: number, name: string) => {
    const preview = buildPreview(state);
    const newSlot: SaveSlotData = {
      name: name.trim() || defaultSaveName(),
      savedAt: Date.now(),
      state,
      ...preview,
    };
    const next = [...slots];
    next[slotIdx] = newSlot;
    setSlots(next);
    saveSlots(next);
    setOverlay(null);
    onSaved?.();
  };

  const doLoad = (slotIdx: number) => {
    const slot = slots[slotIdx];
    if (!slot) return;
    dispatch({ type: 'LOAD_STATE', state: slot.state });
    setOverlay(null);
    onClose();
  };

  const doDelete = (slotIdx: number) => {
    const next = [...slots];
    next[slotIdx] = null;
    setSlots(next);
    saveSlots(next);
    setOverlay(null);
  };

  const handleSlotClick = (slotIdx: number) => {
    const slot = slots[slotIdx];
    if (mode === 'save') {
      if (slot) {
        setOverlay({ type: 'confirm-overwrite', slotIdx });
      } else {
        setOverlay({ type: 'save-name', slotIdx, defaultName: defaultSaveName() });
      }
    } else {
      if (slot) {
        setOverlay({ type: 'confirm-load', slotIdx });
      }
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, slotIdx: number) => {
    e.stopPropagation();
    setOverlay({ type: 'confirm-delete', slotIdx });
  };

  return (
    <div className="sl-overlay" onClick={onClose}>
      <div className="sl-modal" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="sl-header">
          <div className="sl-tabs">
            <button
              className={`sl-tab${mode === 'save' ? ' active' : ''}`}
              onClick={() => { setMode('save'); setOverlay(null); }}
            >
              {t('セーブ')}
            </button>
            <button
              className={`sl-tab${mode === 'load' ? ' active' : ''}`}
              onClick={() => { setMode('load'); setOverlay(null); }}
            >
              {t('ロード')}
            </button>
          </div>
          <button className="sl-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* スロットグリッド */}
        <div className="sl-grid">
          {pageSlotIndices.map((globalIdx) => {
            const slot = slots[globalIdx];
            const displayNum = globalIdx + 1;
            return (
              <div
                key={globalIdx}
                className={`sl-slot${slot ? ' filled' : ' empty'}${mode === 'load' && !slot ? ' disabled' : ''}`}
                onClick={() => handleSlotClick(globalIdx)}
                title={mode === 'save' ? (slot ? '上書きセーブ' : 'セーブ') : (slot ? 'ロード' : '')}
              >
                <div className="sl-slot-num">{displayNum}</div>
                {slot ? (
                  <>
                    <button
                      className="sl-slot-delete"
                      onClick={(e) => handleDeleteClick(e, globalIdx)}
                      title="削除"
                    >
                      ✕
                    </button>
                    <div className="sl-slot-preview">
                      <div className="sl-slot-chars">
                        {slot.previewChars.slice(0, 6).map((c, ci) =>
                          c ? (
                            <img key={ci} src={c.image} alt={c.name} className="sl-char-icon" />
                          ) : (
                            <div key={ci} className="sl-char-empty" />
                          )
                        )}
                      </div>
                    </div>
                    <div className="sl-slot-name">{slot.name}</div>
                    <div className="sl-slot-meta">
                      {formatTime(slot.totalTimeMs)} · {slot.itemCount}手 · {formatDate(slot.savedAt)}
                    </div>
                  </>
                ) : (
                  <div className="sl-slot-empty-label">
                    {mode === 'save' ? t('空きスロット') : t('データなし')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ページナビゲーション */}
        <div className="sl-pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const info = getPageInfo(p);
            const boss = info.isBoss ? bossData[p - 1] : null;
            // rowBreakBefore フラグで強制改行
            const forceBreak = boss && (boss as { rowBreakBefore?: boolean }).rowBreakBefore;
            // ボス→フリーの切れ目にセパレーター（同行内のみ）
            const showSeparator = p === BOSS_PAGE_COUNT + 1 && !forceBreak;
            return (
              <div key={p} style={{ display: 'contents' }}>
                {forceBreak && <div className="sl-row-break" />}
                {showSeparator && <div className="sl-page-separator" />}
                <button
                  className={`sl-page-btn${p === page ? ' active' : ''}`}
                  onClick={() => { setPage(p); setOverlay(null); }}
                  title={info.isBoss ? info.name : `フリー ${info.freeNum}`}
                >
                  {info.isBoss ? (
                    <img src={info.image} alt={info.name} className="sl-page-icon" />
                  ) : (
                    <span className="sl-page-free-num">{info.freeNum}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* オーバーレイダイアログ */}
        {overlay && (
          <div className="sl-dialog-overlay" onClick={() => setOverlay(null)}>
            <div className="sl-dialog" onClick={(e) => e.stopPropagation()}>

              {overlay.type === 'confirm-overwrite' && (
                <>
                  <div className="sl-dialog-title">上書きしますか？</div>
                  <div className="sl-dialog-msg">
                    スロット {overlay.slotIdx + 1} のデータを上書きします。
                  </div>
                  <div className="sl-dialog-btns">
                    <button className="sl-dialog-btn ok" onClick={() =>
                      setOverlay({ type: 'save-name', slotIdx: overlay.slotIdx, defaultName: slots[overlay.slotIdx]?.name ?? defaultSaveName() })
                    }>{t('上書き')}</button>
                    <button className="sl-dialog-btn cancel" onClick={() => setOverlay(null)}>{t('キャンセル')}</button>
                  </div>
                </>
              )}

              {overlay.type === 'save-name' && (
                <>
                  <div className="sl-dialog-title">セーブ名を入力</div>
                  <input
                    ref={nameInputRef}
                    className="sl-dialog-input"
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') doSave(overlay.slotIdx, nameInput);
                      if (e.key === 'Escape') setOverlay(null);
                    }}
                    maxLength={20}
                    placeholder={t('セーブ名...')}
                  />
                  <div className="sl-dialog-btns">
                    <button className="sl-dialog-btn ok" onClick={() => doSave(overlay.slotIdx, nameInput)}>{t('セーブ')}</button>
                    <button className="sl-dialog-btn cancel" onClick={() => setOverlay(null)}>{t('キャンセル')}</button>
                  </div>
                </>
              )}

              {overlay.type === 'confirm-load' && (
                <>
                  <div className="sl-dialog-title">ロードしますか？</div>
                  <div className="sl-dialog-msg">
                    「{slots[overlay.slotIdx]?.name}」をロードします。<br />
                    現在の状態は失われます。
                  </div>
                  <div className="sl-dialog-btns">
                    <button className="sl-dialog-btn ok" onClick={() => doLoad(overlay.slotIdx)}>{t('ロード')}</button>
                    <button className="sl-dialog-btn cancel" onClick={() => setOverlay(null)}>{t('キャンセル')}</button>
                  </div>
                </>
              )}

              {overlay.type === 'confirm-delete' && (
                <>
                  <div className="sl-dialog-title">削除しますか？</div>
                  <div className="sl-dialog-msg">
                    スロット {overlay.slotIdx + 1}「{slots[overlay.slotIdx]?.name}」を削除します。
                  </div>
                  <div className="sl-dialog-btns">
                    <button className="sl-dialog-btn danger" onClick={() => doDelete(overlay.slotIdx)}>{t('削除')}</button>
                    <button className="sl-dialog-btn cancel" onClick={() => setOverlay(null)}>{t('キャンセル')}</button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
