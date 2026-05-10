import { useState, useEffect, useRef, useCallback } from 'react';
import type { StandaloneComment } from '../../types';
import './TextMarkerPanel.css';

interface Props {
  standaloneComments: StandaloneComment[];
  onSetComments: (comments: StandaloneComment[]) => void;
}

function msToCS(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function commentsToText(comments: StandaloneComment[]): string {
  return [...comments]
    .sort((a, b) => b.timeMs - a.timeMs)
    .map((c) => `${msToCS(c.timeMs)} ${c.text}`)
    .join('\n');
}

function textToComments(text: string, existing: StandaloneComment[]): StandaloneComment[] {
  const result: StandaloneComment[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // M:SS / M:SS.d / M:SS.dd / M:SS.ddd
    const m = line.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?\s*(.*)/);
    if (!m) continue;
    const ms =
      (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 +
      parseInt((m[3] ?? '').padEnd(3, '0'));
    const text = m[4].trim();
    const found = existing.find((c) => c.timeMs === ms && c.text === text);
    result.push(found ?? { id: crypto.randomUUID(), timeMs: ms, text });
  }
  return result;
}

export function TextMarkerPanel({ standaloneComments, onSetComments }: Props) {
  const [open, setOpen] = useState(false);
  const [localText, setLocalText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const isFromTextArea = useRef(false);

  // standaloneComments → textarea（ドラッグ追加等の外部変更を反映）
  useEffect(() => {
    if (isFromTextArea.current) {
      isFromTextArea.current = false;
      return;
    }
    setLocalText(commentsToText(standaloneComments));
  }, [standaloneComments]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalText(val);
      isFromTextArea.current = true;
      onSetComments(textToComments(val, standaloneComments));
    },
    [onSetComments, standaloneComments],
  );

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

  return (
    <div className="text-marker-panel-wrapper" ref={panelRef}>
      <button
        className={`text-marker-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="テキストマーカーパネル"
      >
        テキスト
      </button>
      {open && (
        <div className="text-marker-panel">
          <div className="text-marker-panel-header">テキスト入力</div>
          <textarea
            className="text-marker-textarea"
            value={localText}
            onChange={handleChange}
            placeholder={'3:30.00 フリーテキスト\n3:20.00 追加テキスト'}
            spellCheck={false}
          />
          <div className="text-marker-panel-hint">
            形式: M:SS.dd テキスト（1行1マーカー）
          </div>
        </div>
      )}
    </div>
  );
}
