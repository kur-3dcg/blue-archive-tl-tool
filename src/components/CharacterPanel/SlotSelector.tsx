import { useState } from 'react';
import type { Character, SlotType, SlotCostConfig } from '../../types';
import { CharacterSearch } from './CharacterSearch';

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
}: Props) {
  const [showSearch, setShowSearch] = useState(false);

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
            ? (character ? `${character.name}（クリックで変更）` : '生徒を選択')
            : (character ? `${character.name}（ドラッグでタイムラインへ）` : '')
          }
        >
          {character ? (
            <img src={character.image} alt={character.name} width={60} height={60} />
          ) : (
            editMode && <div className="slot-empty">+</div>
          )}
        </div>
        {character && (
          <div className="slot-name">{character.name}</div>
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
              コスト:
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
                固有4
              </label>
            )}
          </div>
        )}
      </div>
      {showSearch && (
        <CharacterSearch
          characters={characters}
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
