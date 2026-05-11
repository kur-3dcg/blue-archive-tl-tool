import { useState, useEffect, useRef } from 'react';
import type { StageGimmick } from '../../types';
import { STAGE_GIMMICK_PRESETS } from '../../constants';
import './StageGimmickPanel.css';

interface Props {
  stageGimmicks: StageGimmick[];
  totalTimeMs: number;
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

export function StageGimmickPanel({ stageGimmicks, totalTimeMs, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState('0');
  const [timeInput, setTimeInput] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customRecovery, setCustomRecovery] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const isCustom = preset === CUSTOM_KEY;
  const presetData = !isCustom ? STAGE_GIMMICK_PRESETS[parseInt(preset)] : null;

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
    const timeMs = parseTimeInput(timeInput);
    if (timeMs === null || timeMs <= 0 || timeMs > totalTimeMs) return;

    let label: string;
    let recoveryDelta: number;
    let durationMs: number;

    if (isCustom) {
      label = customLabel.trim() || 'カスタム';
      recoveryDelta = parseInt(customRecovery);
      durationMs = Math.round(parseFloat(customDuration) * 1000);
      if (!isFinite(recoveryDelta) || recoveryDelta <= 0) return;
      if (!isFinite(durationMs) || durationMs <= 0) return;
    } else if (presetData) {
      label = presetData.label;
      recoveryDelta = presetData.recoveryDelta;
      durationMs = presetData.durationMs;
    } else {
      return;
    }

    onAdd({
      id: crypto.randomUUID(),
      timeMs,
      durationMs,
      recoveryDelta,
      label,
    });

    setTimeInput('');
  };

  return (
    <div className="stage-gimmick-wrapper" ref={panelRef}>
      <button
        className={`stage-gimmick-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="ステージギミックパネル"
      >
        ギミック
      </button>
      {open && (
        <div className="stage-gimmick-panel">
          <div className="stage-gimmick-header">ステージギミック</div>
          <div className="stage-gimmick-form">
            <div className="stage-gimmick-row">
              <label className="stage-gimmick-label">プリセット</label>
              <select
                className="stage-gimmick-select"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
              >
                {STAGE_GIMMICK_PRESETS.map((p, i) => (
                  <option key={i} value={String(i)}>{p.label}</option>
                ))}
                <option value={CUSTOM_KEY}>カスタム</option>
              </select>
            </div>
            {isCustom && (
              <>
                <div className="stage-gimmick-row">
                  <label className="stage-gimmick-label">名前</label>
                  <input
                    className="stage-gimmick-input"
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="ギミック名"
                  />
                </div>
                <div className="stage-gimmick-row">
                  <label className="stage-gimmick-label">回復力+</label>
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
                  <label className="stage-gimmick-label">効果時間(秒)</label>
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
            <div className="stage-gimmick-row">
              <label className="stage-gimmick-label">発動時間</label>
              <input
                className="stage-gimmick-input stage-gimmick-input--short"
                type="text"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="1:30"
              />
              <button className="stage-gimmick-add-btn" onClick={handleAdd}>追加</button>
            </div>
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
