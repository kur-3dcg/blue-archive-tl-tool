import { useState, useEffect, useRef } from 'react';
import type { StageGimmick, CharacterSlot } from '../../types';
import { STAGE_GIMMICK_PRESETS } from '../../constants';
import { useT } from '../../i18n';
import './StageGimmickPanel.css';

interface Props {
  stageGimmicks: StageGimmick[];
  totalTimeMs: number;
  slots: CharacterSlot[];
  onAdd: (gimmick: StageGimmick) => void;
  onRemove: (id: string) => void;
}

function parseTimeInput(input: string): number | null {
  const m = input.trim().match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const ms =
    (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 +
    parseInt((m[3] ?? '').padEnd(3, '0'));
  return ms;
}

function msToDisplay(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function secToDisplay(ms: number): string {
  const s = ms / 1000;
  return s === Math.floor(s) ? `${s}s` : `${s.toFixed(1)}s`;
}

const CUSTOM_KEY = '__custom__';

export function StageGimmickPanel({ stageGimmicks, totalTimeMs, slots, onAdd, onRemove }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState('0');
  const [timeInput, setTimeInput] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customRecovery, setCustomRecovery] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const isCustom = preset === CUSTOM_KEY;
  const presetData = !isCustom ? STAGE_GIMMICK_PRESETS[parseInt(preset)] : null;

  // 現在のストライカー数（キャラが設定されているスロットのみ）
  const strikerCount = slots.filter((s) => s.type === 'striker' && s.character !== null).length;
  // 全生徒数（ST+SP、キャラが設定されているスロットのみ）
  const studentCount = slots.filter((s) => s.character !== null).length;

  // プリセットの実効回復力
  const presetRecoveryDelta = presetData
    ? 'recoveryPerStriker' in presetData
      ? presetData.recoveryPerStriker * strikerCount
      : 'recoveryPerStudent' in presetData
        ? presetData.recoveryPerStudent * studentCount
        : 0
    : 0;

  // 固定発動時間を持つプリセット（グレゴリオ等）
  const isFixedTimePreset = presetData && 'fixedTimes' in presetData;

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
    let label: string;
    let recoveryDelta: number;
    let durationMs: number;

    if (isCustom) {
      const timeMs = parseTimeInput(timeInput);
      if (timeMs === null || timeMs <= 0 || timeMs > totalTimeMs) return;
      label = customLabel.trim() || 'カスタム';
      recoveryDelta = parseInt(customRecovery);
      durationMs = Math.round(parseFloat(customDuration) * 1000);
      if (!isFinite(recoveryDelta) || recoveryDelta <= 0) return;
      if (!isFinite(durationMs) || durationMs <= 0) return;
      onAdd({ id: crypto.randomUUID(), timeMs, durationMs, recoveryDelta, label });
      setTimeInput('');
    } else if (isFixedTimePreset && presetData && 'fixedTimes' in presetData) {
      if (presetRecoveryDelta <= 0) return; // 生徒0人では追加しない
      label = presetData.label;
      recoveryDelta = presetRecoveryDelta;
      durationMs = presetData.durationMs;
      for (const timeMs of presetData.fixedTimes) {
        if (timeMs <= totalTimeMs) {
          onAdd({ id: crypto.randomUUID(), timeMs, durationMs, recoveryDelta, label });
        }
      }
    } else if (presetData) {
      const timeMs = parseTimeInput(timeInput);
      if (timeMs === null || timeMs <= 0 || timeMs > totalTimeMs) return;
      label = presetData.label;
      recoveryDelta = presetRecoveryDelta;
      durationMs = presetData.durationMs;
      if (recoveryDelta <= 0) return;
      onAdd({ id: crypto.randomUUID(), timeMs, durationMs, recoveryDelta, label });
      setTimeInput('');
    } else {
      return;
    }
  };

  return (
    <div className="stage-gimmick-wrapper" ref={panelRef}>
      <button
        className={`stage-gimmick-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="ステージギミックパネル"
      >
        {t('ギミック')}
      </button>
      {open && (
        <div className="stage-gimmick-panel">
          <div className="stage-gimmick-header">{t('ステージギミック')}</div>
          <div className="stage-gimmick-form">
            <div className="stage-gimmick-row">
              <label className="stage-gimmick-label">{t('プリセット')}</label>
              <select
                className="stage-gimmick-select"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
              >
                {STAGE_GIMMICK_PRESETS.map((p, i) => (
                  <option key={i} value={String(i)}>{p.label}</option>
                ))}
                <option value={CUSTOM_KEY}>{t('カスタム')}</option>
              </select>
            </div>
            {!isCustom && presetData && 'recoveryPerStriker' in presetData && (
              <div className="stage-gimmick-note">
                回復力 +{presetData.recoveryPerStriker} × ST{strikerCount}人 = <strong>+{presetRecoveryDelta}</strong>
              </div>
            )}
            {!isCustom && presetData && 'recoveryPerStudent' in presetData && (
              <div className="stage-gimmick-note">
                回復力 +{presetData.recoveryPerStudent} × {studentCount}人 = <strong>+{presetRecoveryDelta}</strong>（×6回 一括登録）
              </div>
            )}
            {isCustom && (
              <>
                <div className="stage-gimmick-row">
                  <label className="stage-gimmick-label">{t('名前')}</label>
                  <input
                    className="stage-gimmick-input"
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="ギミック名"
                  />
                </div>
                <div className="stage-gimmick-row">
                  <label className="stage-gimmick-label">{t('回復力+')}</label>
                  <input
                    className="stage-gimmick-input stage-gimmick-input--short"
                    type="number"
                    value={customRecovery}
                    onChange={(e) => setCustomRecovery(e.target.value)}
                    placeholder="1000"
                    min="1"
                  />
                </div>
                <div className="stage-gimmick-row">
                  <label className="stage-gimmick-label">{t('効果時間(秒)')}</label>
                  <input
                    className="stage-gimmick-input stage-gimmick-input--short"
                    type="number"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    placeholder="22"
                    min="0.1"
                    step="0.1"
                  />
                </div>
              </>
            )}
            {isFixedTimePreset ? (
              <div className="stage-gimmick-row">
                <span className="stage-gimmick-note">1:00〜0:10（10秒間隔×6回）</span>
                <button className="stage-gimmick-add-btn" onClick={handleAdd}>{t('追加')}</button>
              </div>
            ) : (
              <div className="stage-gimmick-row">
                <label className="stage-gimmick-label">{t('発動時間')}</label>
                <input
                  className="stage-gimmick-input stage-gimmick-input--short"
                  type="text"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                  placeholder="1:30"
                />
                <button className="stage-gimmick-add-btn" onClick={handleAdd}>{t('追加')}</button>
              </div>
            )}
          </div>
          {stageGimmicks.length > 0 && (
            <div className="stage-gimmick-list">
              {[...stageGimmicks]
                .sort((a, b) => b.timeMs - a.timeMs)
                .map((g) => (
                  <div key={g.id} className="stage-gimmick-item">
                    <span className="stage-gimmick-item-label">{g.label ?? 'ギミック'}</span>
                    <span className="stage-gimmick-item-detail">
                      +{g.recoveryDelta} {secToDisplay(g.durationMs)} @{msToDisplay(g.timeMs)}
                    </span>
                    <button
                      className="stage-gimmick-remove-btn"
                      onClick={() => onRemove(g.id)}
                      title="削除"
                    >×</button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
