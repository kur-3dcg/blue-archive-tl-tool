import { useState } from 'react';
import type { Character, CharacterSlot, SlotCostConfig, GameMode, StandaloneComment, StageGimmick } from '../../types';
import { STRIKER_COUNT, EXTENDED_STRIKER_COUNT } from '../../constants';
import { SlotSelector } from './SlotSelector';
import { TextMarkerPanel } from '../TextMarkerPanel/TextMarkerPanel';
import { StageGimmickPanel } from '../StageGimmickPanel/StageGimmickPanel';
import './CharacterPanel.css';

interface Props {
  mode: GameMode;
  onSetMode: (mode: GameMode) => void;
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
  standaloneComments: StandaloneComment[];
  onSetStandaloneComments: (comments: StandaloneComment[]) => void;
  totalTimeMs: number;
  stageGimmicks: StageGimmick[];
  onAddStageGimmick: (gimmick: StageGimmick) => void;
  onRemoveStageGimmick: (id: string) => void;
}

export function CharacterPanel({
  mode,
  onSetMode,
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
  standaloneComments,
  onSetStandaloneComments,
  totalTimeMs,
  stageGimmicks,
  onAddStageGimmick,
  onRemoveStageGimmick,
}: Props) {
  const [editMode, setEditMode] = useState(true);

  const stCount = mode === 'extended' ? EXTENDED_STRIKER_COUNT : STRIKER_COUNT;
  const stSlots = slots.slice(0, stCount);
  const spSlots = slots.slice(stCount);

  function handleSetMode(newMode: GameMode) {
    if (newMode === mode) return;
    if (window.confirm(
      '編成モードを切り替えると、現在の編成・TLデータはすべて削除されます。\nよろしいですか？'
    )) {
      onSetMode(newMode);
    }
  }

  return (
    <div className="character-panel">
      <div className="panel-main-row">
        <div className="slot-group">
          <div className="slot-group-label">STRIKER</div>
          <div className="slot-group-slots">
            {stSlots.map((slot, i) => (
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
            {spSlots.map((slot, i) => (
              <SlotSelector
                key={stCount + i}
                slotIndex={stCount + i}
                slotType="special"
                character={slot.character}
                characters={spCharacters}
                editMode={editMode}
                onSelect={(c) => onSetCharacter(stCount + i, c)}
                costConfig={slotCostConfigs[stCount + i]}
                onSetCost={(cost) => onSetSlotCost(stCount + i, cost)}
                onSetUniqueWeapon4={(v) => onSetUniqueWeapon4(stCount + i, v)}
                onSetUniqueWeapon2={(v) => onSetUniqueWeapon2(stCount + i, v)}
              />
            ))}
          </div>
        </div>
        <div className="comment-area">
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
          <TextMarkerPanel
            standaloneComments={standaloneComments}
            onSetComments={onSetStandaloneComments}
          />
          <StageGimmickPanel
            stageGimmicks={stageGimmicks}
            totalTimeMs={totalTimeMs}
            onAdd={onAddStageGimmick}
            onRemove={onRemoveStageGimmick}
          />
        </div>
        <div className="panel-btn-group">
          <div className="panel-action-row">
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
          <div className="panel-mode-row" style={{ visibility: editMode ? 'visible' : 'hidden' }}>
            <span className="panel-mode-label">編成モード:</span>
            <button
              className={`game-mode-btn${mode === 'normal' ? ' active' : ''}`}
              onClick={() => handleSetMode('normal')}
            >
              通常
            </button>
            <button
              className={`game-mode-btn${mode === 'extended' ? ' active' : ''}`}
              onClick={() => handleSetMode('extended')}
            >
              制約解除決戦
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
