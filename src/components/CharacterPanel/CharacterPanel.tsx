import { } from 'react';
import type { Character, CharacterSlot, SlotCostConfig, GameMode, StandaloneComment, StageGimmick } from '../../types';
import { STRIKER_COUNT, EXTENDED_STRIKER_COUNT } from '../../constants';
import { ACTIVE_SLOTS, EXTENDED_ACTIVE_SLOTS } from '../../utils/skillQueueValidator';
import { useT, useCharName } from '../../i18n';
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
  onSetSlotDelay: (slotIndex: number, exDelay: number) => void;
  onSetUniqueWeapon4: (slotIndex: number, value: boolean) => void;
  onSetUniqueWeapon2: (slotIndex: number, value: boolean) => void;
  onResetAll: () => void;
  standaloneComments: StandaloneComment[];
  onSetStandaloneComments: (comments: StandaloneComment[]) => void;
  totalTimeMs: number;
  stageGimmicks: StageGimmick[];
  onAddStageGimmick: (gimmick: StageGimmick) => void;
  onRemoveStageGimmick: (id: string) => void;
  skillQueueOrder?: number[];
  onSetSkillQueueOrder: (order: number[]) => void;
  gameReplayMode: boolean;
  onToggleGameReplayMode: () => void;
  currentQueueState: number[]; // 順序付き slotIndex 配列（先頭3がアクティブ）
  editMode: boolean;
  onToggleEditMode: () => void;
  pendingSlotIndex: number | null;
  onSetPendingSlotIndex: (idx: number | null) => void;
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
  onSetSlotDelay,
  onSetUniqueWeapon4,
  onSetUniqueWeapon2,
  onResetAll,
  standaloneComments,
  onSetStandaloneComments,
  totalTimeMs,
  stageGimmicks,
  onAddStageGimmick,
  onRemoveStageGimmick,
  skillQueueOrder,
  onSetSkillQueueOrder,
  gameReplayMode,
  onToggleGameReplayMode,
  currentQueueState,
  editMode,
  onToggleEditMode,
  pendingSlotIndex,
  onSetPendingSlotIndex,
}: Props) {
  const t = useT();
  const charName = useCharName();

  const stCount = mode === 'extended' ? EXTENDED_STRIKER_COUNT : STRIKER_COUNT;
  const stSlots = slots.slice(0, stCount);
  const spSlots = slots.slice(stCount);

  // アクティブスロット数（通常3、制約解除決戦5）
  const activeSlots = mode === 'extended' ? EXTENDED_ACTIVE_SLOTS : ACTIVE_SLOTS;

  // キュー順バッジの色（アクティブ枠はカラー、待機枠はグレー）
  const ACTIVE_BADGE_COLORS = ['#4ade80', '#facc15', '#60a5fa', '#f97316', '#a78bfa'];
  const QUEUE_BADGE_COLORS = Array.from({ length: 10 }, (_, i) =>
    i < activeSlots ? ACTIVE_BADGE_COLORS[i] : '#9ca3af'
  );

  // キュー順の計算・操作
  const filledSlotIndices = slots.map((s, i) => s.character ? i : -1).filter(i => i >= 0);
  const totalFilledSlots = filledSlotIndices.length;

  // 実効キュー順（設定があればフィルタ済み、なければスロット番号順）
  const effectiveQueue: number[] = (() => {
    const base = skillQueueOrder ?? filledSlotIndices;
    const filtered = base.filter(i => filledSlotIndices.includes(i));
    const missing = filledSlotIndices.filter(i => !filtered.includes(i));
    return [...filtered, ...missing];
  })();

  // 1-based の newPos を指定してスロットの順番を変更（対象位置のスロットと入れ替え）
  function handleSetQueuePosition(slotIndex: number, newPos1: number) {
    const newPos = newPos1 - 1; // 0-based
    const currentPos = effectiveQueue.indexOf(slotIndex); // 0-based
    if (currentPos === -1 || currentPos === newPos) return;

    const newQueue = [...effectiveQueue];
    const temp = newQueue[newPos];
    newQueue[newPos] = newQueue[currentPos];
    newQueue[currentPos] = temp;
    onSetSkillQueueOrder(newQueue);
  }

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
        {!editMode && gameReplayMode ? (
          // ゲーム再現モード：アクティブスロットのみ表示
          <div className="skill-queue-display">
            <div className="skill-queue-display-label">{t('スキルスロット')}</div>
            <div className="skill-queue-slots">
              {currentQueueState.slice(0, Math.min(activeSlots, currentQueueState.length)).map((slotIndex, i) => {
                const slot = slots[slotIndex];
                if (!slot?.character) return null;
                const labels = ['Z', 'X', 'C', 'V', 'B'];
                const isPending = pendingSlotIndex === slotIndex;
                return (
                  <div
                    key={i}
                    className={`skill-queue-slot${isPending ? ' pending' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-slot-index', String(slotIndex));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onSetPendingSlotIndex(isPending ? null : slotIndex)}
                    title={`[${labels[i]}] ${charName(slot.character)}（クリックまたはキー[${labels[i]}]で選択→TLクリックで配置）`}
                  >
                    <div className="skill-queue-slot-label">{labels[i]}</div>
                    <img src={slot.character.image} alt={slot.character.name} width={60} height={60} />
                    <div className="skill-queue-slot-name">{charName(slot.character)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // 通常：6スロット表示
          <>
            <div className="slot-group">
              <div className="slot-group-label">STRIKER</div>
              <div className="slot-group-slots">
                {stSlots.map((slot, i) => {
                  const qPos = totalFilledSlots > activeSlots ? effectiveQueue.indexOf(i) + 1 : undefined;
                  return (
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
                      onSetDelay={(delay) => onSetSlotDelay(i, delay)}
                      onSetUniqueWeapon4={(v) => onSetUniqueWeapon4(i, v)}
                      onSetUniqueWeapon2={(v) => onSetUniqueWeapon2(i, v)}
                      queuePosition={qPos}
                      queueBadgeColor={qPos !== undefined ? QUEUE_BADGE_COLORS[qPos - 1] : undefined}
                      totalFilledSlots={totalFilledSlots}
                      onSetQueuePosition={(pos) => handleSetQueuePosition(i, pos)}
                    />
                  );
                })}
              </div>
            </div>
            <div className="slot-group">
              <div className="slot-group-label">SPECIAL</div>
              <div className="slot-group-slots">
                {spSlots.map((slot, i) => {
                  const si = stCount + i;
                  const qPos = totalFilledSlots > activeSlots ? effectiveQueue.indexOf(si) + 1 : undefined;
                  return (
                    <SlotSelector
                      key={si}
                      slotIndex={si}
                      slotType="special"
                      character={slot.character}
                      characters={spCharacters}
                      editMode={editMode}
                      onSelect={(c) => onSetCharacter(si, c)}
                      costConfig={slotCostConfigs[si]}
                      onSetCost={(cost) => onSetSlotCost(si, cost)}
                      onSetDelay={(delay) => onSetSlotDelay(si, delay)}
                      onSetUniqueWeapon4={(v) => onSetUniqueWeapon4(si, v)}
                      onSetUniqueWeapon2={(v) => onSetUniqueWeapon2(si, v)}
                      queuePosition={qPos}
                      queueBadgeColor={qPos !== undefined ? QUEUE_BADGE_COLORS[qPos - 1] : undefined}
                      totalFilledSlots={totalFilledSlots}
                      onSetQueuePosition={(pos) => handleSetQueuePosition(si, pos)}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
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
            <div className="comment-drag-label">{t('コメント')}</div>
          </div>
          <TextMarkerPanel
            standaloneComments={standaloneComments}
            onSetComments={onSetStandaloneComments}
          />
          <StageGimmickPanel
            stageGimmicks={stageGimmicks}
            totalTimeMs={totalTimeMs}
            slots={slots}
            onAdd={onAddStageGimmick}
            onRemove={onRemoveStageGimmick}
          />
        </div>
        <div className="panel-btn-group">
          <div className="panel-action-row">
            <button
              className={`mode-toggle-btn${editMode ? ' editing' : ''}`}
              onClick={onToggleEditMode}
              title={editMode ? '編成モード：生徒の追加・削除ができます' : 'TL作成モード：ドラッグでタイムラインに配置'}
            >
              {editMode ? t('編成中') : t('TL作成中')}
            </button>
            {!editMode && (
              <button
                className={`game-replay-btn${gameReplayMode ? ' active' : ''}`}
                onClick={onToggleGameReplayMode}
                title="ゲーム再現モード：現在アクティブな3スロットをハイライト表示"
              >
                {t('ゲーム再現')}
              </button>
            )}
            <button
              className={`arrow-mode-btn${arrowMode ? ' active' : ''}`}
              onClick={onToggleArrowMode}
              title={arrowMode ? '矢印モード：アイテム間をドラッグで矢印を作成' : '矢印モードOFF'}
            >
              {t('矢印')}
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
              {t('全クリア')}
            </button>
          </div>
          <div className="panel-mode-row" style={{ visibility: editMode ? 'visible' : 'hidden' }}>
            <span className="panel-mode-label">{t('編成モード')}:</span>
            <button
              className={`game-mode-btn${mode === 'normal' ? ' active' : ''}`}
              onClick={() => handleSetMode('normal')}
            >
              {t('通常')}
            </button>
            <button
              className={`game-mode-btn${mode === 'extended' ? ' active' : ''}`}
              onClick={() => handleSetMode('extended')}
            >
              {t('制約解除決戦')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
