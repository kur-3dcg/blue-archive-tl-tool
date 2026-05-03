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
  heavyArmorCount: number;
  redWinterCount: number;
  onSetHeavyArmorCount: (count: number) => void;
  onSetRedWinterCount: (count: number) => void;
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
  heavyArmorCount,
  redWinterCount,
  onSetHeavyArmorCount,
  onSetRedWinterCount,
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
            />
          ))}
        </div>
      </div>
      <button
        className={`mode-toggle-btn${editMode ? ' editing' : ''}`}
        onClick={() => setEditMode((v) => !v)}
        title={editMode ? '編集モード：生徒の追加・削除ができます' : '使用モード：ドラッグでタイムラインに配置'}
      >
        {editMode ? '編集中' : '使用中'}
      </button>
      <button
        className={`arrow-mode-btn${arrowMode ? ' active' : ''}`}
        onClick={onToggleArrowMode}
        title={arrowMode ? '矢印モード：アイテム間をドラッグで矢印を作成' : '矢印モードOFF'}
      >
        矢印
      </button>
      <div className="panel-extra-settings">
        <label className="extra-setting" title="カノエSS用：重装甲ストライカーの人数（自身除外、最大3）">
          重装甲:
          <select
            value={heavyArmorCount}
            onChange={(e) => onSetHeavyArmorCount(Number(e.target.value))}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="extra-setting" title="チェリノSS用：レッドウィンター生��の人数（自身除外、最大3）">
          RW:
          <select
            value={redWinterCount}
            onChange={(e) => onSetRedWinterCount(Number(e.target.value))}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
