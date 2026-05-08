import { useState, useEffect, useRef } from 'react';
import type { TimelineState, TimelineAction } from '../../types';
import './SaveLoadModal.css';

const SAVES_KEY = 'ba-tl-saves';
const SLOT_COUNT = 30;

interface SaveSlotData {
  name: string;
  savedAt: number; // ms timestamp
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
    // 長さが足りない場合は末尾を null で埋める
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

interface Props {
  initialMode: 'save' | 'load';
  state: TimelineState;
  dispatch: React.Dispatch<TimelineAction>;
  onClose: () => void;
}

export function SaveLoadModal({ initialMode, state, dispatch, onClose }: Props) {
  const [slots, setSlots] = useState<SlotArray>(loadSlots);
  const [mode, setMode] = useState<'save' | 'load'>(initialMode);
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // オーバーレイが開いたら name input にフォーカス
  useEffect(() => {
    if (overlay?.type === 'save-name') {
      setNameInput(overlay.defaultName);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [overlay]);

  // Escape で閉じる
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
              セーブ
            </button>
            <button
              className={`sl-tab${mode === 'load' ? ' active' : ''}`}
              onClick={() => { setMode('load'); setOverlay(null); }}
            >
              ロード
            </button>
          </div>
          <button className="sl-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* スロットグリッド */}
        <div className="sl-grid">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className={`sl-slot${slot ? ' filled' : ' empty'}${mode === 'load' && !slot ? ' disabled' : ''}`}
              onClick={() => handleSlotClick(idx)}
              title={mode === 'save' ? (slot ? '上書きセーブ' : 'セーブ') : (slot ? 'ロード' : '')}
            >
              <div className="sl-slot-num">{idx + 1}</div>
              {slot ? (
                <>
                  <button
                    className="sl-slot-delete"
                    onClick={(e) => handleDeleteClick(e, idx)}
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
                  {mode === 'save' ? '空きスロット' : 'データなし'}
                </div>
              )}
            </div>
          ))}
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
                    }>上書き</button>
                    <button className="sl-dialog-btn cancel" onClick={() => setOverlay(null)}>キャンセル</button>
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
                    placeholder="セーブ名..."
                  />
                  <div className="sl-dialog-btns">
                    <button className="sl-dialog-btn ok" onClick={() => doSave(overlay.slotIdx, nameInput)}>セーブ</button>
                    <button className="sl-dialog-btn cancel" onClick={() => setOverlay(null)}>キャンセル</button>
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
                    <button className="sl-dialog-btn ok" onClick={() => doLoad(overlay.slotIdx)}>ロード</button>
                    <button className="sl-dialog-btn cancel" onClick={() => setOverlay(null)}>キャンセル</button>
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
                    <button className="sl-dialog-btn danger" onClick={() => doDelete(overlay.slotIdx)}>削除</button>
                    <button className="sl-dialog-btn cancel" onClick={() => setOverlay(null)}>キャンセル</button>
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
