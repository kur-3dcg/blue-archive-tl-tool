import { useState, useEffect, useRef } from 'react';
import type { StudentDrop, CharacterSlot } from '../../types';
import { msToDisplay, parseTimeInput } from '../../utils/timeFormat';
import { useT, useCharName } from '../../i18n';
import './StudentDropPanel.css';

interface Props {
  studentDrops: StudentDrop[];
  totalTimeMs: number;
  slots: CharacterSlot[];
  onAdd: (drop: StudentDrop, commentText: string) => void;
  onRemove: (id: string) => void;
}

export function StudentDropPanel({ studentDrops, totalTimeMs, slots, onAdd, onRemove }: Props) {
  const t = useT();
  const charName = useCharName();
  const [open, setOpen] = useState(false);
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [timeInput, setTimeInput] = useState('');
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // 落とせるのはキャラ設定済みのストライカーのみ（スペシャルは落ちない）
  const droppedSlots = new Set(studentDrops.map((d) => d.slotIndex));
  const candidates = slots
    .map((s, i) => ({ slot: s, index: i }))
    .filter(({ slot }) => slot.type === 'striker' && slot.character !== null);
  const selectable = candidates.filter(({ index }) => !droppedSlots.has(index));
  const selectedIndex = slotIndex !== null && selectable.some((c) => c.index === slotIndex)
    ? slotIndex
    : selectable[0]?.index ?? null;

  // パネル外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAdd = () => {
    if (selectedIndex === null) return;
    const timeMs = parseTimeInput(timeInput);
    if (timeMs === null) {
      setError(t('時間は M:SS または M:SS.000 形式で入力してください'));
      return;
    }
    if (timeMs <= 0 || timeMs > totalTimeMs) {
      setError(`${t('戦闘時間内で入力してください')}（0:00.001〜${msToDisplay(totalTimeMs)}）`);
      return;
    }
    setError('');
    const name = charName(slots[selectedIndex].character);
    onAdd(
      { id: crypto.randomUUID(), slotIndex: selectedIndex, timeMs },
      `${name}${t('落とし')}`
    );
    setTimeInput('');
    setSlotIndex(null);
  };

  return (
    <div className="student-drop-wrapper" ref={panelRef}>
      <button
        className={`student-drop-btn${open ? ' active' : ''}${studentDrops.length > 0 ? ' has-drops' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="落とし生徒：指定時刻以降、その生徒のコスト回復力を除外"
      >
        {t('落とし生徒')}{studentDrops.length > 0 ? ` (${studentDrops.length})` : ''}
      </button>
      {open && (
        <div className="student-drop-panel">
          <div className="student-drop-header">{t('落とし生徒')}</div>
          <div className="student-drop-note">{t('落ちた時刻からその生徒のコスト回復力（700・SS）を除外します')}</div>
          {selectable.length === 0 ? (
            <div className="student-drop-empty">
              {candidates.length === 0 ? t('ストライカーが編成されていません') : t('全ストライカーが設定済みです')}
            </div>
          ) : (
            <div className="student-drop-form">
              <div className="student-drop-students">
                {selectable.map(({ slot, index }) => (
                  <button
                    key={index}
                    className={`student-drop-student${index === selectedIndex ? ' selected' : ''}`}
                    onClick={() => setSlotIndex(index)}
                    title={charName(slot.character)}
                  >
                    <img src={slot.character!.image} alt={charName(slot.character)} />
                  </button>
                ))}
              </div>
              <div className="student-drop-row">
                <label className="student-drop-label">{t('落ちる時間')}</label>
                <input
                  className="student-drop-input"
                  type="text"
                  value={timeInput}
                  onChange={(e) => { setTimeInput(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                  placeholder="3:30.000"
                />
                <button className="student-drop-add-btn" onClick={handleAdd}>{t('追加')}</button>
              </div>
              {error && <div className="student-drop-error">{error}</div>}
            </div>
          )}
          {studentDrops.length > 0 && (
            <div className="student-drop-list">
              {[...studentDrops]
                .sort((a, b) => b.timeMs - a.timeMs)
                .map((d) => {
                  const char = slots[d.slotIndex]?.character ?? null;
                  return (
                    <div key={d.id} className="student-drop-item">
                      {char && <img className="student-drop-item-icon" src={char.image} alt="" />}
                      <span className="student-drop-item-label">{charName(char)}</span>
                      <span className="student-drop-item-time">@{msToDisplay(d.timeMs)}</span>
                      <button
                        className="student-drop-remove-btn"
                        onClick={() => onRemove(d.id)}
                        title="削除"
                      >×</button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
