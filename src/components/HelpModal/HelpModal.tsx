import { useEffect } from 'react';
import { useT } from '../../i18n';
import './HelpModal.css';

const HELP_SEEN_KEY = 'tl-help-seen';

interface Props {
  onClose: () => void;
}

export function HelpModal({ onClose }: Props) {
  const t = useT();

  useEffect(() => {
    localStorage.setItem(HELP_SEEN_KEY, '1');
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-header">
          <h2 className="help-modal-title">{t('操作方法')}</h2>
          <button className="help-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="help-modal-content">
          <table className="help-modal-table">
            <tbody>
              <tr><td className="help-key">{t('ドラッグ')}</td><td>{t('スキルをタイムラインに配置 / 移動')}</td></tr>
              <tr><td className="help-key">{t('右クリック')}</td><td>{t('削除')}</td></tr>
              <tr><td className="help-key">{t('クリック')}</td><td>{t('コスト⇔時間表示切替')}</td></tr>
              <tr><td className="help-key">{t('ダブルクリック')}</td><td>{t('フリーコメント追加（緑バブル）')}</td></tr>
              <tr><td className="help-key">{t('Ctrl+クリック')}</td><td>{t('キャラ依存コメント（黄色吹き出し）')}</td></tr>
              <tr><td className="help-key">{t('Alt+クリック')}</td><td>{t('矢印接続')}</td></tr>
              <tr><td className="help-key">{t('Shift+クリック')}</td><td>{t('EX対象指定')}</td></tr>
              <tr><td className="help-key">{t('Shift+ホイール')}</td><td>{t('TL横スクロール')}</td></tr>
              <tr><td className="help-key">{t('Ctrl+ホイール')}</td><td>{t('TL横スクロール（TL領域のみ）')}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function shouldShowHelp(): boolean {
  return !localStorage.getItem(HELP_SEEN_KEY);
}
