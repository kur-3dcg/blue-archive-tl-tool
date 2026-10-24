import { useState, useEffect, useRef } from 'react';
import type { StageGimmick, CharacterSlot } from '../../types';
import { STAGE_GIMMICK_PRESETS } from '../../constants';
import { useT } from '../../i18n';
import { msToDisplay as msToDisplayFull, parseTimeInput } from '../../utils/timeFormat';
import './StageGimmickPanel.css';

interface Props {
  stageGimmicks: StageGimmick[];
  totalTimeMs: number;
  slots: CharacterSlot[];
  onAdd: (gimmick: StageGimmick) => void;
  onRemove: (id: string) => void;
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
  const [customKind, setCustomKind] = useState<'add' | 'mul' | 'fixed'>('add');
  const [customGain, setCustomGain] = useState('');
  const [customRecovery, setCustomRecovery] = useState('');
  const [customPercent, setCustomPercent] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const isCustom = preset === CUSTOM_KEY;
  const presetData = !isCustom ? STAGE_GIMMICK_PRESETS[parseInt(preset)] : null;

  // 現在のストライカー数（キャラが設定されているスロットのみ）
  const strikerCount = slots.filter((s) => s.type === 'striker' && s.character !== null).length;
  // 全生徒数（ST+SP、キャラが設定されているスロットのみ）
  const studentCount = slots.filter((s) => s.character !== null).length;

  // 乗算プリセット（ゲブラ 知性の根源等）
  const presetPercent = presetData && 'recoveryPercent' in presetData ? presetData.recoveryPercent : undefined;
  // 人数比例プリセット（人数はコスト計算時にその時点の残り人数で自動計算）
  const presetDynamicPerStudent = presetData && 'dynamicPerStudent' in presetData ? presetData.dynamicPerStudent : undefined;
  const presetDynamicPerStriker = presetData && 'dynamicPerStriker' in presetData ? presetData.dynamicPerStriker : undefined;

  // プリセットの回復力フィールド（StageGimmick に展開）
  const presetValueFields: Pick<StageGimmick, 'recoveryDelta' | 'recoveryPercent' | 'recoveryPerStudent' | 'recoveryPerStriker'> = {
    recoveryDelta: 0,
    ...(presetPercent !== undefined ? { recoveryPercent: presetPercent } : {}),
    ...(presetDynamicPerStudent !== undefined ? { recoveryPerStudent: presetDynamicPerStudent } : {}),
    ...(presetDynamicPerStriker !== undefined ? { recoveryPerStriker: presetDynamicPerStriker } : {}),
  };

  // 効果時間を手入力するプリセット
  const isManualDuration = !!presetData && 'manualDuration' in presetData;

  // 固定発動時間を持つプリセット（グレゴリオ等）
  const isFixedTimePreset = presetData && 'fixedTimes' in presetData;
  // 常時発動プリセット（戦闘開始〜終了）
  const isAlwaysPreset = presetData && 'always' in presetData;

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

  // 発動時間の検証（不正ならエラー表示して null）
  const validateTime = (): number | null => {
    const timeMs = parseTimeInput(timeInput);
    if (timeMs === null) {
      setError(t('時間は M:SS または M:SS.000 形式で入力してください'));
      return null;
    }
    if (timeMs <= 0 || timeMs > totalTimeMs) {
      setError(`${t('戦闘時間内で入力してください')}（0:00.001〜${msToDisplayFull(totalTimeMs)}）`);
      return null;
    }
    return timeMs;
  };

  const handleAdd = () => {
    setError('');
    let label: string;
    let recoveryDelta: number;
    let durationMs: number;

    if (isCustom) {
      const timeMs = validateTime();
      if (timeMs === null) return;
      label = customLabel.trim() || 'カスタム';
      if (customKind === 'fixed') {
        // 固定獲得: 発動時刻に所持コストを即時加算（効果時間なし）
        const costGain = parseFloat(customGain);
        if (!isFinite(costGain) || costGain === 0) {
          setError(t('獲得コストを入力してください'));
          return;
        }
        onAdd({ id: crypto.randomUUID(), timeMs, durationMs: 0, recoveryDelta: 0, costGain, label });
        setTimeInput('');
        return;
      }
      durationMs = Math.round(parseFloat(customDuration) * 1000);
      if (!isFinite(durationMs) || durationMs <= 0) {
        setError(t('効果時間（秒）を正の数で入力してください'));
        return;
      }
      if (customKind === 'mul') {
        const recoveryPercent = parseFloat(customPercent);
        if (!isFinite(recoveryPercent) || recoveryPercent === 0) {
          setError(t('回復速度%を入力してください'));
          return;
        }
        onAdd({ id: crypto.randomUUID(), timeMs, durationMs, recoveryDelta: 0, recoveryPercent, label });
      } else {
        recoveryDelta = parseInt(customRecovery);
        if (!isFinite(recoveryDelta) || recoveryDelta <= 0) {
          setError(t('回復力を正の数で入力してください'));
          return;
        }
        onAdd({ id: crypto.randomUUID(), timeMs, durationMs, recoveryDelta, label });
      }
      setTimeInput('');
    } else if (presetData) {
      label = presetData.label;
      if ('always' in presetData) {
        // 戦闘開始（総時間）から終了（0:00）まで
        onAdd({ id: crypto.randomUUID(), timeMs: totalTimeMs, durationMs: totalTimeMs, ...presetValueFields, label });
        return;
      }
      if ('durationMs' in presetData) {
        durationMs = presetData.durationMs;
      } else {
        durationMs = Math.round(parseFloat(customDuration) * 1000);
        if (!isFinite(durationMs) || durationMs <= 0) {
          setError(t('効果時間（秒）を正の数で入力してください'));
          return;
        }
      }
      if ('fixedTimes' in presetData) {
        for (const timeMs of presetData.fixedTimes) {
          if (timeMs <= totalTimeMs) {
            onAdd({ id: crypto.randomUUID(), timeMs, durationMs, ...presetValueFields, label });
          }
        }
        return;
      }
      const timeMs = validateTime();
      if (timeMs === null) return;
      onAdd({ id: crypto.randomUUID(), timeMs, durationMs, ...presetValueFields, label });
      setTimeInput('');
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
                onChange={(e) => { setPreset(e.target.value); setError(''); }}
              >
                {STAGE_GIMMICK_PRESETS.map((p, i) => (
                  <option key={i} value={String(i)}>{p.label}</option>
                ))}
                <option value={CUSTOM_KEY}>{t('カスタム')}</option>
              </select>
            </div>
            {!isCustom && presetDynamicPerStriker !== undefined && (
              <div className="stage-gimmick-note">
                回復力 +{presetDynamicPerStriker} × 残りST数（現在{strikerCount}人 = <strong>+{presetDynamicPerStriker * strikerCount}</strong>）
              </div>
            )}
            {!isCustom && presetDynamicPerStudent !== undefined && (
              <div className="stage-gimmick-note">
                回復力 +{presetDynamicPerStudent} × 残り人数（現在{studentCount}人 = <strong>+{presetDynamicPerStudent * studentCount}</strong>）
              </div>
            )}
            {isManualDuration && (
              <div className="stage-gimmick-row">
                <label className="stage-gimmick-label">{t('効果時間(秒)')}</label>
                <input
                  className="stage-gimmick-input stage-gimmick-input--short"
                  type="number"
                  value={customDuration}
                  onChange={(e) => { setCustomDuration(e.target.value); setError(''); }}
                  placeholder="35"
                  min="0.1"
                  step="0.1"
                />
              </div>
            )}
            {!isCustom && presetPercent !== undefined && (
              <div className="stage-gimmick-note">
                回復速度 <strong>×{(1 + presetPercent / 100).toFixed(2)}</strong>（+{presetPercent}%）
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
                  <label className="stage-gimmick-label">{t('種類')}</label>
                  <label className="stage-gimmick-radio">
                    <input
                      type="radio"
                      name="stage-gimmick-kind"
                      checked={customKind === 'add'}
                      onChange={() => setCustomKind('add')}
                    />
                    {t('加算')}
                  </label>
                  <label className="stage-gimmick-radio">
                    <input
                      type="radio"
                      name="stage-gimmick-kind"
                      checked={customKind === 'mul'}
                      onChange={() => setCustomKind('mul')}
                    />
                    {t('乗算')}
                  </label>
                  <label className="stage-gimmick-radio">
                    <input
                      type="radio"
                      name="stage-gimmick-kind"
                      checked={customKind === 'fixed'}
                      onChange={() => setCustomKind('fixed')}
                    />
                    {t('固定')}
                  </label>
                </div>
                {customKind === 'fixed' ? (
                  <div className="stage-gimmick-row">
                    <label className="stage-gimmick-label">{t('コスト+')}</label>
                    <input
                      className="stage-gimmick-input stage-gimmick-input--short"
                      type="number"
                      value={customGain}
                      onChange={(e) => setCustomGain(e.target.value)}
                      placeholder="3"
                      step="0.1"
                    />
                  </div>
                ) : customKind === 'add' ? (
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
                ) : (
                  <div className="stage-gimmick-row">
                    <label className="stage-gimmick-label">{t('回復速度%')}</label>
                    <input
                      className="stage-gimmick-input stage-gimmick-input--short"
                      type="number"
                      value={customPercent}
                      onChange={(e) => setCustomPercent(e.target.value)}
                      placeholder="25"
                      step="0.1"
                    />
                  </div>
                )}
                {customKind !== 'fixed' && (
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
                )}
              </>
            )}
            {isAlwaysPreset ? (
              <div className="stage-gimmick-row">
                <span className="stage-gimmick-note">{t('常時（戦闘開始〜終了）')}</span>
                <button className="stage-gimmick-add-btn" onClick={handleAdd}>{t('追加')}</button>
              </div>
            ) : isFixedTimePreset ? (
              <div className="stage-gimmick-row">
                <span className="stage-gimmick-note">
                  {presetData && 'fixedTimes' in presetData
                    ? presetData.fixedTimes.length === 1
                      ? `${msToDisplay(presetData.fixedTimes[0])}（1回 一括登録）`
                      : `${msToDisplay(presetData.fixedTimes[0])}〜${msToDisplay(presetData.fixedTimes[presetData.fixedTimes.length - 1])}（${presetData.fixedTimes.length}回 一括登録）`
                    : ''}
                </span>
                <button className="stage-gimmick-add-btn" onClick={handleAdd}>{t('追加')}</button>
              </div>
            ) : (
              <div className="stage-gimmick-row">
                <label className="stage-gimmick-label">{t('発動時間')}</label>
                <input
                  className="stage-gimmick-input stage-gimmick-input--short"
                  type="text"
                  value={timeInput}
                  onChange={(e) => { setTimeInput(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                  placeholder="1:30"
                />
                <button className="stage-gimmick-add-btn" onClick={handleAdd}>{t('追加')}</button>
              </div>
            )}
            {error && <div className="stage-gimmick-error">{error}</div>}
          </div>
          {stageGimmicks.length > 0 && (
            <div className="stage-gimmick-list">
              {[...stageGimmicks]
                .sort((a, b) => b.timeMs - a.timeMs)
                .map((g) => (
                  <div key={g.id} className="stage-gimmick-item">
                    <span className="stage-gimmick-item-label">{g.label ?? 'ギミック'}</span>
                    <span className="stage-gimmick-item-detail">
                      {g.costGain !== undefined
                        ? `${g.costGain >= 0 ? '+' : ''}${g.costGain}コスト`
                        : g.recoveryPercent !== undefined
                        ? `+${g.recoveryPercent}%`
                        : g.recoveryPerStudent !== undefined
                          ? `+${g.recoveryPerStudent}×人数`
                          : g.recoveryPerStriker !== undefined
                            ? `+${g.recoveryPerStriker}×ST数`
                            : `+${g.recoveryDelta}`} {g.costGain === undefined ? secToDisplay(g.durationMs) : ''} @{msToDisplay(g.timeMs)}
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
