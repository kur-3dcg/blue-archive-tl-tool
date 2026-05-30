import { useState, useRef, useEffect } from 'react';
import type { Character, SlotType, SlotCostConfig } from '../../types';
import { CharacterSearch } from './CharacterSearch';
import { useT, useCharName } from '../../i18n';

interface Props {
  slotIndex: number;
  slotType: SlotType;
  character: Character | null;
  characters: Character[];
  editMode: boolean;
  onSelect: (character: Character | null) => void;
  costConfig: SlotCostConfig;
  onSetCost: (cost: number) => void;
  onSetUniqueWeapon4: (value: boolean) => void;
  onSetUniqueWeapon2: (value: boolean) => void;
  queuePosition?: number; // 1-based。undefined = キュー順非表示
  queueBadgeColor?: string;
  totalFilledSlots?: number;
  onSetQueuePosition?: (pos: number) => void; // 1-based
}

export function SlotSelector({
  slotIndex,
  slotType,
  character,
  characters,
  editMode,
  onSelect,
  costConfig,
  onSetCost,
  onSetUniqueWeapon4,
  onSetUniqueWeapon2,
  queuePosition,
  queueBadgeColor,
  totalFilledSlots,
  onSetQueuePosition,
}: Props) {
  const t = useT();
  const charName = useCharName();
  const [showSearch, setShowSearch] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // ピッカー外クリックで閉じる
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const handleDragStart = (e: React.DragEvent) => {
    if (!character || editMode) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/x-slot-index', String(slotIndex));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleFaceClick = () => {
    if (editMode) {
      setShowSearch(true);
    }
  };

  return (
    <>
      <div
        className={`slot-selector slot-${slotType}${editMode ? ' edit-mode' : ''}`}
        draggable={!!character && !editMode}
        onDragStart={handleDragStart}
      >
        <div
          className="slot-face"
          onClick={handleFaceClick}
          title={editMode
            ? (character ? `${charName(character)}（クリックで変更）` : t('生徒を選択'))
            : (character ? `${charName(character)}（ドラッグでタイムラインへ）` : '')
          }
        >
          {character ? (
            <img src={character.image} alt={character.name} width={60} height={60} />
          ) : (
            editMode && <div className="slot-empty">+</div>
          )}
        </div>
        {character && editMode && queuePosition !== undefined && (
          <div className="slot-queue-badge-wrap" ref={pickerRef}>
            <div
              className="slot-queue-badge"
              style={{ background: queueBadgeColor }}
              onClick={(e) => { e.stopPropagation(); setShowPicker(v => !v); }}
              title={`スキル使用順: ${queuePosition}番目（クリックで変更）`}
            >
              {queuePosition}
            </div>
            {showPicker && (
              <div className="slot-queue-picker">
                {Array.from({ length: totalFilledSlots ?? 1 }, (_, i) => i + 1).map(pos => (
                  <button
                    key={pos}
                    className={`slot-queue-picker-btn${pos === queuePosition ? ' current' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetQueuePosition?.(pos);
                      setShowPicker(false);
                    }}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {character && (
          <div className="slot-name">{charName(character)}</div>
        )}
        {character && editMode && (
          <button
            className="slot-clear"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }}
            title="解除"
          >
            ×
          </button>
        )}
        {character && (
          <div className="slot-cost-area">
            <label className="slot-cost-label">
              {t('コスト')}:
              <input
                className="slot-cost-input"
                type="number"
                min={0}
                max={10}
                step={1}
                value={costConfig.skillCost}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 0 && v <= 10) onSetCost(v);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </label>
            {slotType === 'special' && (
              <label className="slot-unique-weapon" title="固有武器4（コスト上限+0.5）">
                <input
                  type="checkbox"
                  checked={costConfig.hasUniqueWeapon4}
                  onChange={(e) => onSetUniqueWeapon4(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                {t('固有4')}
              </label>
            )}
            <label className="slot-unique-weapon" title="固有武器2↑（バフ効果持続力×1.19）">
              <input
                type="checkbox"
                checked={costConfig.hasUniqueWeapon2}
                onChange={(e) => onSetUniqueWeapon2(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
              {t('固有2')}
            </label>
          </div>
        )}
      </div>
      {showSearch && (
        <CharacterSearch
          characters={characters}
          currentCharacter={character}
          onSelect={(c) => {
            onSelect(c);
            setShowSearch(false);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}
    </>
  );
}
