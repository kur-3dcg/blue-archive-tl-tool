import { useState, useEffect, useRef } from 'react';
import type { Character, CharacterSlot, SlotCostConfig, GameMode, StandaloneComment, StageGimmick, SnapMode } from '../../types';
import { STRIKER_COUNT, EXTENDED_STRIKER_COUNT, TIME_PRESETS, MAX_TOTAL_TIME_MS, MAX_LAYERS } from '../../constants';
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
  onClearTl: () => void;
  onResetAll: () => void;
  standaloneComments: StandaloneComment[];
  onSetStandaloneComments: (comments: StandaloneComment[]) => void;
  totalTimeMs: number;
  stageGimmicks: StageGimmick[];
  onAddStageGimmick: (gimmick: StageGimmick) => void;
  onRemoveStageGimmick: (id: string) => void;
  skillQueueOrder?: number[];
  onSetSkillQueueOrder: (order: number[]) => void;
  onSetSkillIndex: (slotIndex: number, skillIndex: number) => void;
  onSwapSlots: (slotA: number, slotB: number) => void;
  gameReplayMode: boolean;
  onToggleGameReplayMode: () => void;
  currentQueueState: number[];
  editMode: boolean;
  onToggleEditMode: () => void;
  pendingSlotIndex: number | null;
  onSetPendingSlotIndex: (idx: number | null) => void;
  // TL制御系（Timeline から移動）
  snapMode: SnapMode;
  onSetSnapMode: (m: SnapMode) => void;
  locked: boolean;
  onSetLocked: (v: boolean) => void;
  queueValidation: boolean;
  onSetQueueValidation: (v: boolean) => void;
  showNsLayers: boolean;
  onToggleNsLayers: () => void;
  layerCount: number;
  onSetLayers: (n: number) => void;
  targetTimeMs: number | undefined;
  onSetTargetTime: (ms: number | undefined) => void;
  onSetTotalTime: (ms: number) => void;
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
  onClearTl,
  onResetAll,
  standaloneComments,
  onSetStandaloneComments,
  totalTimeMs,
  stageGimmicks,
  onAddStageGimmick,
  onRemoveStageGimmick,
  skillQueueOrder,
  onSetSkillQueueOrder,
  onSetSkillIndex,
  onSwapSlots,
  gameReplayMode,
  onToggleGameReplayMode,
  currentQueueState,
  editMode,
  onToggleEditMode,
  pendingSlotIndex,
  onSetPendingSlotIndex,
  snapMode,
  onSetSnapMode,
  locked,
  onSetLocked,
  queueValidation,
  onSetQueueValidation,
  showNsLayers,
  onToggleNsLayers,
  layerCount,
  onSetLayers,
  targetTimeMs,
  onSetTargetTime,
  onSetTotalTime,
}: Props) {
  const t = useT();
  const charName = useCharName();
  const [tlSettingsOpen, setTlSettingsOpen] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [targetTimeInput, setTargetTimeInput] = useState('');
  const [textMarkerOpen, setTextMarkerOpen] = useState(false);
  const textMarkerWrapperRef = useRef<HTMLDivElement>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [dragFromSlot, setDragFromSlot] = useState<number | null>(null);

  // テキストマーカーパネル外クリックで閉じる
  useEffect(() => {
    if (!textMarkerOpen) return;
    const handler = (e: MouseEvent) => {
      if (textMarkerWrapperRef.current && !textMarkerWrapperRef.current.contains(e.target as Node)) {
        setTextMarkerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [textMarkerOpen]);

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

  // 実効キュー順
  const effectiveQueue: number[] = (() => {
    const base = skillQueueOrder ?? filledSlotIndices;
    const filtered = base.filter(i => filledSlotIndices.includes(i));
    const missing = filledSlotIndices.filter(i => !filtered.includes(i));
    return [...filtered, ...missing];
  })();

  function handleSetQueuePosition(slotIndex: number, newPos1: number) {
    const newPos = newPos1 - 1;
    const currentPos = effectiveQueue.indexOf(slotIndex);
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

  // スロット共通レンダリング（ツールバー行の compact 表示）
  const renderCompactSlots = () => {
    if (!editMode && gameReplayMode) {
      // ゲーム再現モード
      const labels = ['Z', 'X', 'C', 'V', 'B'];
      return (
        <div className="skill-queue-display">
          <div className="skill-queue-display-label">{t('スキルスロット')}</div>
          <div className="skill-queue-slots">
            {currentQueueState.slice(0, Math.min(activeSlots, currentQueueState.length)).map((slotIndex, i) => {
              const slot = slots[slotIndex];
              if (!slot?.character) return null;
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
      );
    }

    // 編成中: アイコン行＋設定行を同一グリッドで表示（列が自動的に揃う）
    if (editMode) {
      return (
        <div
          className="slots-with-settings-grid"
          style={{ gridTemplateColumns: `auto repeat(${slots.length}, max-content)` }}
        >
          {/* アイコン行（ドラッグで入れ替え） */}
          <div className="settings-row-label" />
          {slots.map((slot, i) => {
            const qPos = totalFilledSlots > activeSlots ? effectiveQueue.indexOf(i) + 1 : undefined;
            return (
              <div
                key={i}
                className={`slot-icon-cell${dragOverSlot === i ? ' drag-over' : ''}`}
                onDragOver={(e) => {
                  if (
                    dragFromSlot !== null &&
                    dragFromSlot !== i &&
                    (dragFromSlot < stCount) === (i < stCount) &&
                    e.dataTransfer.types.includes('application/x-slot-reorder')
                  ) {
                    e.preventDefault();
                    setDragOverSlot(i);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverSlot(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData('application/x-slot-reorder'));
                  if (!isNaN(from) && from !== i) onSwapSlots(from, i);
                  setDragOverSlot(null);
                }}
              >
                {slot.character && (
                  <div
                    className="slot-reorder-handle"
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.setData('application/x-slot-reorder', String(i));
                      e.dataTransfer.effectAllowed = 'move';
                      setDragFromSlot(i);
                    }}
                    onDragEnd={() => { setDragOverSlot(null); setDragFromSlot(null); }}
                    title="ドラッグでスロットを入れ替え"
                  >
                    ⠿
                  </div>
                )}
                <SlotSelector
                  slotIndex={i}
                  slotType={i < stCount ? 'striker' : 'special'}
                  character={slot.character}
                  characters={i < stCount ? stCharacters : spCharacters}
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
                  onSetSkillIndex={(idx) => onSetSkillIndex(i, idx)}
                  compact
                />
              </div>
            );
          })}

          {/* コスト行 */}
          <div className="settings-row-label">{t('コスト')}</div>
          {slots.map((slot, i) => (
            <div key={i} className="settings-cell">
              {slot.character && (
                <input className="slot-cost-input" type="number" min={0} max={10} step={1}
                  value={slotCostConfigs[i].skillCost}
                  onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 10) onSetSlotCost(i, v); }}
                />
              )}
            </div>
          ))}

          {/* ディレイ行 */}
          <div className="settings-row-label">{'ディレイ'}</div>
          {slots.map((slot, i) => (
            <div key={i} className="settings-cell">
              {slot.character && (
                <input className="slot-cost-input" type="number" min={0} max={10} step={0.01}
                  value={slotCostConfigs[i].exDelay ?? 0}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) onSetSlotDelay(i, v); }}
                />
              )}
            </div>
          ))}

          {/* 固有2行 */}
          <div className="settings-row-label">{t('固有2')}</div>
          {slots.map((slot, i) => (
            <div key={i} className="settings-cell">
              {slot.character && (
                <input type="checkbox"
                  checked={slotCostConfigs[i].hasUniqueWeapon2}
                  onChange={(e) => onSetUniqueWeapon2(i, e.target.checked)}
                  title={t('固有2')}
                />
              )}
            </div>
          ))}

          {/* 固有4行（SPのみ） */}
          <div className="settings-row-label" title="固有武器4（コスト上限+0.5）">{t('固有4')}</div>
          {slots.map((slot, i) => (
            <div key={i} className="settings-cell">
              {i >= stCount && slot.character && (
                <input type="checkbox"
                  checked={slotCostConfigs[i].hasUniqueWeapon4}
                  onChange={(e) => onSetUniqueWeapon4(i, e.target.checked)}
                  title="固有武器4（コスト上限+0.5）"
                />
              )}
            </div>
          ))}
        </div>
      );
    }

    // TL作成中: コンパクトアイコン + EXタブ行
    const hasMultiEX = slots.some(s => s.character?.skills && s.character.skills.length > 1);
    return (
      <div
        className="slots-with-settings-grid"
        style={{ gridTemplateColumns: `auto repeat(${slots.length}, max-content)` }}
      >
        {/* アイコン行 */}
        <div className="settings-row-label" />
        {slots.map((slot, i) => {
          const qPos = totalFilledSlots > activeSlots ? effectiveQueue.indexOf(i) + 1 : undefined;
          return (
            <div key={i} className="slot-icon-cell">
              <SlotSelector
                slotIndex={i}
                slotType={i < stCount ? 'striker' : 'special'}
                character={slot.character}
                characters={i < stCount ? stCharacters : spCharacters}
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
                onSetSkillIndex={(idx) => onSetSkillIndex(i, idx)}
                compact
              />
            </div>
          );
        })}

        {/* EXタブ行（複数EXキャラがいる場合のみ） */}
        {hasMultiEX && (
          <>
            <div className="settings-row-label">EX</div>
            {slots.map((slot, i) => (
              <div key={i} className="settings-cell">
                {slot.character?.skills && slot.character.skills.length > 1 && (
                  <div className="slot-skill-tabs">
                    {slot.character.skills.map((skill, idx) => (
                      <button
                        key={idx}
                        className={`slot-skill-tab${(slotCostConfigs[i].activeSkillIndex ?? 0) === idx ? ' active' : ''}`}
                        onClick={() => onSetSkillIndex(i, idx)}
                        title={skill.label}
                      >{skill.label}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="character-panel">
      {/* ─── ツールバー行 ─── */}
      <div className="panel-toolbar-row">
        {/* 行1: 編成中/TL切替 + コンパクトスロット + モード依存ボタン */}
        <div className="panel-toolbar-top">
          <button
            className={`mode-toggle-btn${editMode ? ' editing' : ''}`}
            onClick={onToggleEditMode}
            title={editMode ? '編成モード：生徒の追加・削除ができます' : 'TL作成モード：ドラッグでタイムラインへ配置'}
          >
            {editMode ? t('編成中') : t('TL作成中')}
          </button>

          <div className="panel-slots-area">
            {renderCompactSlots()}
          </div>

          {editMode && (
            <div className="panel-mode-select">
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
          )}
        </div>

        {/* 行2: ツールボタン群 */}
        <div className="panel-toolbar-bottom">
          {/* 左グループ: コメント → 矢印 → スナップ → 移動可 */}
          <div className="toolbar-left">
            <div className="text-marker-panel-wrapper" ref={textMarkerWrapperRef}>
              <div
                className={`comment-drag-btn${editMode ? ' disabled' : ''}${textMarkerOpen ? ' active' : ''}`}
                draggable={!editMode}
                onDragStart={(e) => {
                  if (editMode) { e.preventDefault(); return; }
                  e.dataTransfer.setData('application/x-standalone-comment', 'true');
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => setTextMarkerOpen(v => !v)}
                title="クリック：テキスト入力パネル / ドラッグ：タイムラインにコメントを配置"
              >
                <svg className="comment-drag-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
                <div className="comment-drag-label">{t('コメント')}</div>
              </div>
              <TextMarkerPanel
                standaloneComments={standaloneComments}
                onSetComments={onSetStandaloneComments}
                open={textMarkerOpen}
              />
            </div>
            <button
              className={`arrow-mode-btn${arrowMode ? ' active' : ''}`}
              onClick={onToggleArrowMode}
              title={arrowMode ? '矢印モード：アイテム間をドラッグで矢印を作成' : '矢印モードOFF'}
            >
              {t('矢印')}
            </button>
            <button
              className={`preset-btn${snapMode === '1F' ? ' active' : ''}`}
              onClick={() => onSetSnapMode(snapMode === '0.1s' ? '1F' : '0.1s')}
              title="スナップ切替（0.1秒 / 1フレーム≈33ms）"
            >
              {snapMode === '1F' ? '1F' : t('0.1秒')}
            </button>
            <button
              className={`preset-btn${locked ? ' active' : ''}`}
              onClick={() => onSetLocked(!locked)}
              title="ONにするとスキルアイコンのドラッグ移動を禁止（クリック操作は可能）"
            >
              {locked ? t('🔒移動禁止') : t('🔓移動可')}
            </button>
          </div>

          {/* 右グループ: ゲーム再現 → スキル順 → ギミック → TL設定 → 全クリア */}
          <div className="toolbar-right">
            {!editMode && (
              <>
                <button
                  className={`game-replay-btn${gameReplayMode ? ' active' : ''}`}
                  onClick={onToggleGameReplayMode}
                  title="ゲーム再現モード：現在アクティブな3スロットをハイライト表示"
                >
                  {t('ゲーム再現')}
                </button>
                <button
                  className={`preset-btn${queueValidation ? ' active' : ''}`}
                  onClick={() => onSetQueueValidation(!queueValidation)}
                  title="スキル順検証：ゲーム内のスキルカード順に合わないアイテムを赤くハイライト"
                >
                  {t('スキル順')}
                </button>
              </>
            )}
            <StageGimmickPanel
              stageGimmicks={stageGimmicks}
              totalTimeMs={totalTimeMs}
              slots={slots}
              onAdd={onAddStageGimmick}
              onRemove={onRemoveStageGimmick}
            />
            <button
              className={`preset-btn${tlSettingsOpen ? ' active' : ''}`}
              onClick={() => setTlSettingsOpen(v => !v)}
              title="TL設定（総時間・レイヤー・目標時間）を開閉"
            >
              {t('TL設定')}▼
            </button>
            <button
              className="reset-all-btn"
              onClick={() => {
                if (window.confirm('タイムライン上のアイテム・コメント・矢印・ギミックをクリアします。\nこの操作は取り消せません。よろしいですか？')) {
                  onClearTl();
                }
              }}
              title="TLのみリセット（編成は残す）"
            >
              {t('TLクリア')}
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
        </div>

      </div>{/* /panel-toolbar-row */}

      {/* ─── TL設定展開エリア（トグル） ─── */}
      {tlSettingsOpen && (
        <div className="panel-tl-settings-expand">
          <span className="tl-control">
            {t('時間')}:
            {TIME_PRESETS.map((p) => (
              <button
                key={p.ms}
                className={`preset-btn${totalTimeMs === p.ms ? ' active' : ''}`}
                onClick={() => onSetTotalTime(p.ms)}
              >
                {p.label}
              </button>
            ))}
            <input
              className="custom-time-input"
              type="text"
              placeholder="M:SS"
              value={customTimeInput}
              onChange={(e) => setCustomTimeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const m = customTimeInput.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
                if (!m) return;
                const ms = (Number(m[1]) * 60 + Number(m[2])) * 1000 + Number((m[3] ?? '').padEnd(3, '0'));
                if (ms > 0 && ms <= MAX_TOTAL_TIME_MS) {
                  onSetTotalTime(ms);
                  setCustomTimeInput('');
                }
              }}
              title="自由入力（例: 4:30 / 10:00）Enterで確定（最大10:00）"
            />
          </span>
          <label className="tl-control">
            {t('レイヤー')}:
            <select
              value={layerCount}
              onChange={(e) => onSetLayers(Number(e.target.value))}
            >
              {Array.from({ length: MAX_LAYERS }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`preset-btn${showNsLayers ? ' active' : ''}`}
            onClick={onToggleNsLayers}
            title="NSレイヤーを表示/非表示（各キャラのNS発動タイミング記入エリア）"
          >
            {t('NS表示')}
          </button>
          <span className="tl-control">
            {t('目標')}:
            <input
              className="custom-time-input"
              type="text"
              placeholder="M:SS.000"
              value={targetTimeInput}
              onChange={(e) => setTargetTimeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const val = targetTimeInput.trim();
                if (!val) {
                  onSetTargetTime(undefined);
                  setTargetTimeInput('');
                  return;
                }
                const m = val.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
                if (!m) return;
                const ms = (Number(m[1]) * 60 + Number(m[2])) * 1000 + Number((m[3] ?? '').padEnd(3, '0'));
                if (ms >= 0 && ms <= totalTimeMs) {
                  onSetTargetTime(ms);
                  setTargetTimeInput('');
                }
              }}
              title="目標時間を入力（例: 1:30 / 1:30.500）Enterで確定、空欄で削除"
            />
            {targetTimeMs !== undefined && (
              <button
                className="preset-btn"
                onClick={() => {
                  onSetTargetTime(undefined);
                  setTargetTimeInput('');
                }}
                title="目標時間を削除"
              >
                {t('解除')}
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
