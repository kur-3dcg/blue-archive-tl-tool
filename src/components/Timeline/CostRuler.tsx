import { useRef, useEffect, useState, useMemo } from 'react';
import type { CharacterSlot, TimelineItem, SlotCostConfig, StageGimmick } from '../../types';
import { TIMELINE_PAD_LEFT, TIMELINE_PAD_RIGHT } from '../../constants';
import { calculateCostTimeline, calculateCostCap, computeArmorCounts } from '../../utils/costCalc';

const COST_RULER_HEIGHT = 140;
const GIMMICK_BAND_HEIGHT = 16;

interface Props {
  slots: CharacterSlot[];
  items: TimelineItem[];
  slotCostConfigs: SlotCostConfig[];
  totalTimeMs: number;
  zoomLevel: number;
  totalWidth: number;
  stageGimmicks?: StageGimmick[];
}

export function CostRuler({
  slots,
  items,
  slotCostConfigs,
  totalTimeMs,
  zoomLevel,
  totalWidth,
  stageGimmicks,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const totalTimeS = totalTimeMs / 1000;

  const costCap = useMemo(() => calculateCostCap(slotCostConfigs, slots), [slotCostConfigs, slots]);

  const keypoints = useMemo(() => {
    const { heavyArmorCount, redWinterCount } = computeArmorCounts(slots);
    return calculateCostTimeline(slots, items, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks);
  }, [slots, items, slotCostConfigs, totalTimeMs, stageGimmicks]);

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

    const gimmickBandH = (stageGimmicks && stageGimmicks.length > 0) ? GIMMICK_BAND_HEIGHT : 0;
    const graphTop = 4 + gimmickBandH;
    const graphBottom = COST_RULER_HEIGHT - 4;
    const graphHeight = graphBottom - graphTop;

    const maxCostDisplay = Math.ceil(costCap);
    const costToY = (cost: number) => graphBottom - (cost / maxCostDisplay) * graphHeight;
    const timeMsToX = (timeMs: number) =>
      totalWidth - TIMELINE_PAD_RIGHT - (timeMs / 1000) * zoomLevel;

    // ギミック帯（グラフ最上部に描画）
    if (stageGimmicks && stageGimmicks.length > 0) {
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (const g of stageGimmicks) {
        const startX = timeMsToX(g.timeMs);
        const endMs = Math.max(0, g.timeMs - g.durationMs);
        const endX = timeMsToX(endMs);
        const bandY = 2;
        ctx.fillStyle = 'rgba(251, 146, 60, 0.3)';
        ctx.fillRect(endX, bandY, startX - endX, GIMMICK_BAND_HEIGHT - 2);
        // ボーダー
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(endX + 0.5, bandY + 0.5, startX - endX - 1, GIMMICK_BAND_HEIGHT - 3);
        // ラベル
        ctx.fillStyle = 'rgba(251, 146, 60, 0.95)';
        const bandWidth = startX - endX;
        const labelText = g.label ? `${g.label} +${g.recoveryDelta}` : `+${g.recoveryDelta}`;
        if (bandWidth > 20) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(endX + 2, bandY, bandWidth - 4, GIMMICK_BAND_HEIGHT - 2);
          ctx.clip();
          ctx.fillText(labelText, endX + 3, bandY + (GIMMICK_BAND_HEIGHT - 2) / 2);
          ctx.restore();
        }
      }
    }

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

    // Draw cost curve with colored segments (red=overrun, yellow=overcost, blue=normal)
    if (keypoints.length >= 2) {
      for (let i = 0; i < keypoints.length - 1; i++) {
        const kpA = keypoints[i];
        const kpB = keypoints[i + 1];
        const isRedSegment = kpA.isOverrun || kpB.isOverrun;
        const isYellowSegment = !isRedSegment && (kpA.isOvercost || kpB.isOvercost);

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
          : isYellowSegment
          ? 'rgba(200, 160, 0, 0.25)'
          : 'rgba(59, 130, 246, 0.15)';
        ctx.fill();

        // Line for this segment
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = isRedSegment
          ? 'rgba(239, 68, 68, 0.9)'
          : isYellowSegment
          ? 'rgba(200, 160, 0, 0.95)'
          : 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [keypoints, costCap, zoomLevel, totalWidth, totalTimeS, theme, totalTimeMs, stageGimmicks]);

  return <canvas ref={canvasRef} className="cost-ruler" />;
}

export { COST_RULER_HEIGHT };
