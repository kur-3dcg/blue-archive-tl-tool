import { useRef, useEffect, useState, useMemo } from 'react';
import type { CharacterSlot, TimelineItem, SlotCostConfig } from '../../types';
import { TIMELINE_PAD_LEFT, TIMELINE_PAD_RIGHT } from '../../constants';
import { calculateCostTimeline, calculateCostCap } from '../../utils/costCalc';

const COST_RULER_HEIGHT = 140;

interface Props {
  slots: CharacterSlot[];
  items: TimelineItem[];
  slotCostConfigs: SlotCostConfig[];
  totalTimeMs: number;
  zoomLevel: number;
  totalWidth: number;
  heavyArmorCount: number;
  redWinterCount: number;
}

export function CostRuler({
  slots,
  items,
  slotCostConfigs,
  totalTimeMs,
  zoomLevel,
  totalWidth,
  heavyArmorCount,
  redWinterCount,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const totalTimeS = totalTimeMs / 1000;

  const costCap = useMemo(() => calculateCostCap(slotCostConfigs), [slotCostConfigs]);

  const keypoints = useMemo(
    () => calculateCostTimeline(slots, items, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount),
    [slots, items, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount]
  );

  // Re-render on theme change
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

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--ruler-text').trim() || 'rgba(255,255,255,0.6)';
    const lineColor = styles.getPropertyValue('--ruler-line').trim() || 'rgba(255,255,255,0.25)';

    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalWidth * dpr;
    canvas.height = COST_RULER_HEIGHT * dpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${COST_RULER_HEIGHT}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, totalWidth, COST_RULER_HEIGHT);

    const graphTop = 4;
    const graphBottom = COST_RULER_HEIGHT - 4;
    const graphHeight = graphBottom - graphTop;

    const maxCostDisplay = Math.ceil(costCap);
    const costToY = (cost: number) => graphBottom - (cost / maxCostDisplay) * graphHeight;
    const timeMsToX = (timeMs: number) =>
      totalWidth - TIMELINE_PAD_RIGHT - (timeMs / 1000) * zoomLevel;

    // Draw horizontal grid lines at each integer cost
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (let c = 0; c <= maxCostDisplay; c++) {
      const y = costToY(c);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = c === 0 ? 1 : 0.5;
      ctx.globalAlpha = c === 0 ? 0.6 : 0.3;
      ctx.beginPath();
      ctx.moveTo(TIMELINE_PAD_LEFT, y);
      ctx.lineTo(totalWidth - TIMELINE_PAD_RIGHT, y);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.7;
      ctx.fillText(String(c), TIMELINE_PAD_LEFT - 4, y + 3.5);
      ctx.globalAlpha = 1;
    }

    // Draw cap line (if fractional)
    if (costCap !== maxCostDisplay) {
      const capY = costToY(costCap);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(TIMELINE_PAD_LEFT, capY);
      ctx.lineTo(totalWidth - TIMELINE_PAD_RIGHT, capY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#f59e0b';
      ctx.font = '9px monospace';
      ctx.globalAlpha = 0.9;
      ctx.fillText(costCap.toFixed(1), TIMELINE_PAD_LEFT - 4, capY + 3);
      ctx.globalAlpha = 1;
    }

    // Draw cost curve with overrun segments in red
    if (keypoints.length >= 2) {
      // Split into segments: each pair of consecutive keypoints is a segment
      // Draw filled area and line per segment, colored by overrun state
      for (let i = 0; i < keypoints.length - 1; i++) {
        const kpA = keypoints[i];
        const kpB = keypoints[i + 1];
        const isRedSegment = kpA.isOverrun || kpB.isOverrun;

        const ax = timeMsToX(kpA.timeMs);
        const bx = timeMsToX(kpB.timeMs);
        const ay = costToY(Math.min(kpA.cost, costCap));
        const by = costToY(Math.min(kpB.cost, costCap));
        const baseY = costToY(0);

        // Filled area for this segment
        ctx.beginPath();
        ctx.moveTo(ax, baseY);
        ctx.lineTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx, baseY);
        ctx.closePath();
        ctx.fillStyle = isRedSegment
          ? 'rgba(239, 68, 68, 0.2)'
          : 'rgba(59, 130, 246, 0.15)';
        ctx.fill();

        // Line for this segment
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = isRedSegment
          ? 'rgba(239, 68, 68, 0.9)'
          : 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [keypoints, costCap, zoomLevel, totalWidth, totalTimeS, theme, totalTimeMs]);

  return <canvas ref={canvasRef} className="cost-ruler" />;
}

export { COST_RULER_HEIGHT };
