import { useState, useEffect, useRef } from 'react';
import { CharacterPanel } from './components/CharacterPanel/CharacterPanel';
import { Timeline } from './components/Timeline/Timeline';
import { SharePanel, buildLoadState } from './components/SharePanel/SharePanel';
import { useTimelineState } from './hooks/useTimelineState';
import { decode } from './utils/shareCodec';
import stCharacters from '../data/characters_st.json';
import spCharacters from '../data/characters_sp.json';
import './themes.css';
import './App.css';

type Theme = 'dark' | 'light' | 'blue';

const THEME_LABELS: Record<Theme, string> = {
  dark: 'ダーク',
  light: 'ライト',
  blue: 'ブルー',
};

export default function App() {
  const [state, dispatch] = useTimelineState();
  const [arrowMode, setArrowMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('tl-theme') as Theme) || 'dark';
  });
  const hashImported = useRef(false);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tl-theme', theme);
  }, [theme]);

  // URLハッシュからの自動インポート（初回のみ）
  useEffect(() => {
    if (hashImported.current) return;
    const hash = window.location.hash.slice(1); // # を除去
    if (!hash) return;
    hashImported.current = true;

    (async () => {
      try {
        const data = await decode(hash);
        if (data) {
          dispatch({
            type: 'LOAD_STATE',
            state: buildLoadState(data, state.slots, state.totalTimeMs),
          });
          // ハッシュをクリア（URLを綺麗にする）
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch {
        // 無効なハッシュは無視
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <header className="app-header">
        <h1>ブルアカ TL作成支援ツール</h1>
        <div className="app-header-right">
          <SharePanel state={state} dispatch={dispatch} />
          <div className="theme-selector">
            <label>テーマ:</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
                <option key={t} value={t}>
                  {THEME_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="hamburger-menu" ref={menuRef}>
            <button
              className={`hamburger-btn${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="メニュー"
            >
              <span /><span /><span />
            </button>
            {menuOpen && (
              <div className="hamburger-dropdown">
                <div className="hamburger-section-label">他のツール</div>
                <a href="https://kur-3dcg.github.io/blue-archive-faceimage/index.html" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                  戦術対抗戦編成記録ツール
                </a>
                <a href="https://kur-3dcg.github.io/Furniture-placement-simulator/" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                  家具シミュレーションツール
                </a>
                <a href="https://kur-3dcg.github.io/Tactical-Battle-Stone-Accounting/index.html" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                  石割収支管理ツール
                </a>
                <div className="hamburger-divider" />
                <a href="https://x.com/kur_3dcg" target="_blank" rel="noopener noreferrer" className="hamburger-contact" onClick={() => setMenuOpen(false)}>
                  ご意見・ご感想・バグ報告などはこちら
                </a>
              </div>
            )}
          </div>
        </div>
      </header>
      <CharacterPanel
        slots={state.slots}
        stCharacters={stCharacters}
        spCharacters={spCharacters}
        onSetCharacter={(slotIndex, character) =>
          dispatch({ type: 'SET_CHARACTER', slotIndex, character })
        }
        arrowMode={arrowMode}
        onToggleArrowMode={() => setArrowMode((v) => !v)}
        slotCostConfigs={state.slotCostConfigs}
        onSetSlotCost={(slotIndex, skillCost) =>
          dispatch({ type: 'SET_SLOT_COST', slotIndex, skillCost })
        }
        onSetUniqueWeapon4={(slotIndex, value) =>
          dispatch({ type: 'SET_UNIQUE_WEAPON4', slotIndex, value })
        }
        onSetUniqueWeapon2={(slotIndex, value) =>
          dispatch({ type: 'SET_UNIQUE_WEAPON2', slotIndex, value })
        }
        heavyArmorCount={state.heavyArmorCount}
        redWinterCount={state.redWinterCount}
        onSetHeavyArmorCount={(count) =>
          dispatch({ type: 'SET_HEAVY_ARMOR_COUNT', count })
        }
        onSetRedWinterCount={(count) =>
          dispatch({ type: 'SET_RED_WINTER_COUNT', count })
        }
      />
      <Timeline state={state} dispatch={dispatch} arrowMode={arrowMode} />
    </div>
  );
}
