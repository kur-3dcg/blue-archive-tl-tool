import { useState, useEffect, useRef } from 'react';
import type { Character } from '../../types';
import { BOSS_PRESETS, applyBossPreset } from '../../data/bossPresets';
import type { BossPresetLoadState } from '../../data/bossPresets';
import bossesJson from '../../../data/bosses.json';
import './BossPresetPanel.css';

interface BossEntry {
  name: string;
  image: string;
  rowBreakBefore?: boolean;
}

interface Props {
  stCharacters: Character[];
  spCharacters: Character[];
  onLoad: (loadState: BossPresetLoadState) => void;
}

export function BossPresetPanel({ stCharacters, spCharacters, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const presetNames = new Set(BOSS_PRESETS.map((p) => p.name));

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

  const handleBossClick = (boss: BossEntry) => {
    const preset = BOSS_PRESETS.find((p) => p.name === boss.name);
    if (!preset) return;

    const confirmed = window.confirm(
      `「${boss.name}」のプリセットを読み込みます。\n現在の編成・TLデータは上書きされます。よろしいですか？`
    );
    if (!confirmed) return;

    onLoad(applyBossPreset(preset, stCharacters, spCharacters));
    setOpen(false);
  };

  // bosses.json を rowBreakBefore に従って行分け
  const rows: BossEntry[][] = [];
  let currentRow: BossEntry[] = [];
  for (const boss of bossesJson as BossEntry[]) {
    if (boss.rowBreakBefore && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
    }
    currentRow.push(boss);
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return (
    <div className="boss-preset-wrapper" ref={panelRef}>
      <button
        className={`boss-preset-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="ボスプリセット：ボスを選択して編成・TL設定を一括ロード"
      >
        ボスプリセット
      </button>
      {open && (
        <div className="boss-preset-panel">
          <div className="boss-preset-header">ボスプリセット</div>
          <div className="boss-preset-grid-rows">
            {rows.map((row, ri) => (
              <div key={ri} className="boss-preset-row">
                {row.map((boss) => {
                  const hasPreset = presetNames.has(boss.name);
                  return (
                    <button
                      key={boss.name}
                      className={`boss-preset-item${hasPreset ? ' has-preset' : ' no-preset'}`}
                      onClick={() => hasPreset && handleBossClick(boss)}
                      disabled={!hasPreset}
                      title={hasPreset ? `${boss.name}（クリックで読み込み）` : `${boss.name}（プリセットなし）`}
                    >
                      <img src={boss.image} alt={boss.name} width={44} height={44} />
                      <span className="boss-preset-item-name">{boss.name}</span>
                      {hasPreset && <span className="boss-preset-badge">◆</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
