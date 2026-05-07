import { useState } from 'react';
import type { Character, CharacterSlot, SlotCostConfig } from '../../types';
import { SlotSelector } from './SlotSelector';
import './CharacterPanel.css';

interface Props {
  slots: CharacterSlot[];
  stCharacters: Character[];
  spCharacters: Character[];
  onSetCharacter: (slotIndex: number, character: Character | null) => void;
  arrowMode: boolean;
  onToggleArrowMode: () => void;
  slotCostConfigs: SlotCostConfig[];
  onSetSlotCost: (slotIndex: number, skillCost: number) => void;
  onSetUniqueWeapon4: (slotIndex: number, value: boolean) => void;
  onSetUniqueWeapon2: (slotIndex: number, value: boolean) => void;
  onResetAll: () => void;
}

export function CharacterPanel({
  slots,
  stCharacters,
  spCharacters,
  onSetCharacter,
  arrowMode,
  onToggleArrowMode,
  slotCostConfigs,
  onSetSlotCost,
  onSetUniqueWeapon4,
  onSetUniqueWeapon2,
  onResetAll,
}: Props) {
  const [editMode, setEditMode] = useState(true);

  return (
    <div className="character-panel">
      <div className="slot-group">
        <div className="slot-group-label">STRIKER</div>
        <div className="slot-group-slots">
          {slots.slice(0, 4).map((slot, i) => (
            <SlotSelector
              key={i}
              slotIndex={i}
              slotType="striker"
              character={slot.character}
              characters={stCharacters}
              editMode={editMode}
              onSelect={(c) => onSetCharacter(i, c)}
              costConfig={slotCostConfigs[i]}
              onSetCost={(cost) => onSetSlotCost(i, cost)}
              onSetUniqueWeapon4={(v) => onSetUniqueWeapon4(i, v)}
              onSetUniqueWeapon2={(v) => onSetUniqueWeapon2(i, v)}
            />
          ))}
        </div>
      </div>
      <div className="slot-group">
        <div className="slot-group-label">SPECIAL</div>
        <div className="slot-group-slots">
          {slots.slice(4, 6).map((slot, i) => (
            <SlotSelector
              key={i + 4}
              slotIndex={i + 4}
              slotType="special"
              character={slot.character}
              characters={spCharacters}
              editMode={editMode}
              onSelect={(c) => onSetCharacter(i + 4, c)}
              costConfig={slotCostConfigs[i + 4]}
              onSetCost={(cost) => onSetSlotCost(i + 4, cost)}
              onSetUniqueWeapon4={(v) => onSetUniqueWeapon4(i + 4, v)}
              onSetUniqueWeapon2={(v) => onSetUniqueWeapon2(i + 4, v)}
            />
          ))}
        </div>
      </div>
      <div
        className={`comment-drag-btn${editMode ? ' disabled' : ''}`}
        draggable={!editMode}
        onDragStart={(e) => {
          if (editMode) { e.preventDefault(); return; }
          e.dataTransfer.setData('application/x-standalone-comment', 'true');
          e.dataTransfer.effectAllowed = 'copy';
        }}
        title={editMode ? 'TL作成中モードでドラッグしてコメントを配置' : 'ドラッグしてタイムラインにコメントを配置'}
      >
        <svg className="comment-drag-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <div className="comment-drag-label">コメント</div>
      </div>
      <button
        className={`mode-toggle-btn${editMode ? ' editing' : ''}`}
        onClick={() => setEditMode((v) => !v)}
        title={editMode ? '編成モード：生徒の追加・削除ができます' : 'TL作成モード：ドラッグでタイムラインに配置'}
      >
        {editMode ? '編成中' : 'TL作成中'}
      </button>
      <button
        className={`arrow-mode-btn${arrowMode ? ' active' : ''}`}
        onClick={onToggleArrowMode}
        title={arrowMode ? '矢印モード：アイテム間をドラッグで矢印を作成' : '矢印モードOFF'}
      >
        矢印
      </button>
      <button
        className="reset-all-btn"
        onClick={() => {
          if (window.confirm('編成・TLのデータをすべてクリアします。\nこの操作は取り消せません。よろしいですか？')) {
            onResetAll();
          }
        }}
        title="編成・TLをすべてリセット"
      >
        全クリア
      </button>
    </div>
  );
}
