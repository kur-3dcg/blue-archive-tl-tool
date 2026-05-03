import { useRef, useEffect, useState } from 'react';
import type { SnapMode } from '../../types';
import { RULER_HEIGHT, TIMELINE_PAD_LEFT, TIMELINE_PAD_RIGHT } from '../../constants';

interface Props {
  zoomLevel: number;
  snapMode: SnapMode;
  totalTimeS: number;
}

export function TimelineRuler({ zoomLevel, snapMode, totalTimeS }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineWidth = totalTimeS * zoomLevel;
  const canvasWidth = TIMELINE_PAD_LEFT + timelineWidth + TIMELINE_PAD_RIGHT;

  // Re-render when data-theme attribute changes
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Read theme colors from CSS variables
    const styles = getComputedStyle(document.documentElement);
    const lineColor = styles.getPropertyValue('--ruler-line').trim() || 'rgba(255,255,255,0.25)';
    const lineSubColor = styles.getPropertyValue('--ruler-line-sub').trim() || 'rgba(255,255,255,0.08)';
    const textColor = styles.getPropertyValue('--ruler-text').trim() || 'rgba(255,255,255,0.6)';

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = RULER_HEIGHT * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${RULER_HEIGHT}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, RULER_HEIGHT);

    const gridSeconds = snapMode === '1s' ? 1 : 0.1;
    const totalSteps = Math.floor(totalTimeS / gridSeconds);

    for (let i = 0; i <= totalSteps; i++) {
      const sec = i * gridSeconds;
      const x = TIMELINE_PAD_LEFT + timelineWidth - sec * zoomLevel;

      const is10s = Math.abs(sec - Math.round(sec / 10) * 10) < 0.001;
      const is1s = Math.abs(sec - Math.round(sec)) < 0.001;

      if (is10s) {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, RULER_HEIGHT);
        ctx.stroke();

        const min = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const label = `${min}:${String(s).padStart(2, '0')}`;
        ctx.fillStyle = textColor;
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, 12);
      } else if (is1s) {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, RULER_HEIGHT * 0.4);
        ctx.lineTo(x, RULER_HEIGHT);
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (zoomLevel >= 8) {
          const min = Math.floor(sec / 60);
          const s = Math.floor(sec % 60);
          ctx.fillStyle = textColor;
          ctx.globalAlpha = 0.6;
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${min}:${String(s).padStart(2, '0')}`, x, 12);
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.strokeStyle = lineSubColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, RULER_HEIGHT * 0.7);
        ctx.lineTo(x, RULER_HEIGHT);
        ctx.stroke();
      }
    }
  }, [zoomLevel, snapMode, canvasWidth, timelineWidth, totalTimeS, theme]);

  return <canvas ref={canvasRef} className="timeline-ruler" />;
}
