import type { TimelineState } from '../types';
import { calculateItemCosts, computeArmorCounts } from './costCalc';
import { costToDisplay } from './timeFormat';

function msToMSS(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawTextClipped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number
) {
  if (ctx.measureText(text).width <= maxW) {
    ctx.fillText(text, x, y);
    return;
  }
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxW) {
    truncated = truncated.slice(0, -1);
  }
  ctx.fillText(truncated + '…', x, y);
}

export async function generateTlImage(state: TimelineState, options: { transparent?: boolean } = {}): Promise<Blob> {
  const transparent = options.transparent ?? true;
  const { slots, items, slotCostConfigs, totalTimeMs, targetTimeMs, standaloneComments } = state;

  const { heavyArmorCount, redWinterCount } = computeArmorCounts(slots);
  const costMap = calculateItemCosts(
    slots, items, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount
  );

  const filteredItems = items.filter(
    (item) =>
      slots[item.slotIndex]?.character &&
      (targetTimeMs === undefined || item.timeMs >= targetTimeMs)
  );

  const sorted = [...filteredItems].sort((a, b) => b.timeMs - a.timeMs);
  const groups: (typeof sorted)[] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0].timeMs === item.timeMs) {
      last.push(item);
    } else {
      groups.push([item]);
    }
  }
  for (const group of groups) {
    group.sort((a, b) => {
      if (a.layerIndex !== b.layerIndex) return a.layerIndex - b.layerIndex;
      return items.indexOf(a) - items.indexOf(b);
    });
  }

  const filteredComments = (standaloneComments ?? []).filter(
    (sc) => targetTimeMs === undefined || sc.timeMs >= targetTimeMs
  );

  type Entry =
    | { kind: 'comment'; timeMs: number; text: string }
    | { kind: 'skill'; timeMs: number; group: typeof sorted }
    | { kind: 'kill'; timeMs: number };

  const entries: Entry[] = [
    ...filteredComments.map((sc) => ({ kind: 'comment' as const, timeMs: sc.timeMs, text: sc.text })),
    ...groups.map((g) => ({ kind: 'skill' as const, timeMs: g[0].timeMs, group: g })),
    ...(targetTimeMs !== undefined ? [{ kind: 'kill' as const, timeMs: targetTimeMs }] : []),
  ];

  entries.sort((a, b) => {
    if (b.timeMs !== a.timeMs) return b.timeMs - a.timeMs;
    if (a.kind === 'comment' && b.kind !== 'comment') return -1;
    if (b.kind === 'comment' && a.kind !== 'comment') return 1;
    return 0;
  });

  // Pre-load all character face images (main + target)
  const imageUrls = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== 'skill') continue;
    for (const item of entry.group) {
      const img = slots[item.slotIndex]?.character?.image;
      if (img) imageUrls.add(img);
      if (item.targetSlotIndex !== undefined) {
        const tImg = slots[item.targetSlotIndex]?.character?.image;
        if (tImg) imageUrls.add(tImg);
      }
    }
  }
  const imageCache = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    [...imageUrls].map(async (url) => {
      imageCache.set(url, await loadImage(url));
    })
  );

  // Layout constants
  const DPR = 2;
  const ICON_SIZE = 28;
  const ARROW_W = 20;
  const ROW_H = 40;
  const HEADER_H = 28;
  const PAD_H = 10;
  const COL_TIME = 58;
  const COL_COST = 52;
  const COL_COMMENT = 220;

  let maxGroupSize = 1;
  for (const entry of entries) {
    if (entry.kind === 'skill') {
      maxGroupSize = Math.max(maxGroupSize, entry.group.length);
    }
  }
  const COL_EX = maxGroupSize * ICON_SIZE + Math.max(0, maxGroupSize - 1) * ARROW_W + PAD_H * 2;
  const W = COL_TIME + COL_COST + COL_EX + COL_COMMENT;
  const H = HEADER_H + Math.max(1, entries.length) * ROW_H;

  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);

  // Clip entire canvas to rounded rect (gives transparent rounded corners)
  roundedRectPath(ctx, 0, 0, W, H, 10);
  ctx.clip();

  // White background when not transparent
  if (!transparent) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  }

  // Header: subtle light gray background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.fillRect(0, 0, W, HEADER_H);
  // Header bottom border
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, HEADER_H - 1, W, 1);

  // Header text
  ctx.fillStyle = '#111111';
  ctx.font = `bold 11px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const headers: [string, number][] = [
    ['時間', PAD_H],
    ['コスト', COL_TIME + PAD_H],
    ['EX', COL_TIME + COL_COST + PAD_H],
    ['コメント', COL_TIME + COL_COST + COL_EX + PAD_H],
  ];
  for (const [text, x] of headers) {
    ctx.fillText(text, x, HEADER_H / 2);
  }

  // Rows
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const rowY = HEADER_H + i * ROW_H;
    const midY = rowY + ROW_H / 2;

    // Row separator (black line at bottom of row)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, rowY + ROW_H - 1, W, 1);

    // Time column
    ctx.fillStyle = '#111111';
    ctx.font = `12px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(msToMSS(entry.timeMs), PAD_H, midY);

    if (entry.kind === 'skill') {
      const [parent] = entry.group;
      const costInfo = costMap.get(parent.id);
      const costStr = costInfo !== undefined ? costToDisplay(costInfo.usedCost) : '';
      const isOverrun = costInfo?.isOverrun ?? false;

      // Cost column
      ctx.fillStyle = isOverrun ? '#cc2200' : '#111111';
      ctx.font = `12px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(costStr, COL_TIME + PAD_H, midY);

      // EX column: icons with arrows
      let iconX = COL_TIME + COL_COST + PAD_H;
      const iconY = rowY + (ROW_H - ICON_SIZE) / 2;
      for (let j = 0; j < entry.group.length; j++) {
        if (j > 0) {
          ctx.fillStyle = '#333333';
          ctx.font = `12px sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.fillText('→', iconX + ARROW_W / 2, midY);
          iconX += ARROW_W;
        }
        const item = entry.group[j];
        const imgUrl = slots[item.slotIndex]?.character?.image;
        const imgEl = imgUrl ? imageCache.get(imgUrl) : undefined;

        ctx.save();
        roundedRectPath(ctx, iconX, iconY, ICON_SIZE, ICON_SIZE, 4);
        ctx.clip();
        if (imgEl) {
          ctx.drawImage(imgEl, iconX, iconY, ICON_SIZE, ICON_SIZE);
        } else {
          ctx.fillStyle = 'rgba(180,180,180,0.5)';
          ctx.fillRect(iconX, iconY, ICON_SIZE, ICON_SIZE);
          const name = slots[item.slotIndex]?.character?.name ?? '?';
          ctx.fillStyle = '#333';
          ctx.font = `9px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name[0] ?? '?', iconX + ICON_SIZE / 2, iconY + ICON_SIZE / 2);
        }
        ctx.restore();

        // Target icon: circular badge at top-right corner (like UI's .timeline-item-target)
        if (item.targetSlotIndex !== undefined) {
          const tImgUrl = slots[item.targetSlotIndex]?.character?.image;
          const tImgEl = tImgUrl ? imageCache.get(tImgUrl) : undefined;
          const TR = 8; // radius
          const tcx = iconX + ICON_SIZE - TR + 2; // 2px outside right edge
          const tcy = iconY + TR - 2;             // 2px below top edge
          ctx.save();
          ctx.beginPath();
          ctx.arc(tcx, tcy, TR, 0, Math.PI * 2);
          ctx.clip();
          if (tImgEl) {
            ctx.drawImage(tImgEl, tcx - TR, tcy - TR, TR * 2, TR * 2);
          } else {
            ctx.fillStyle = 'rgba(180,180,180,0.7)';
            ctx.fill();
          }
          ctx.restore();
          // Amber border ring
          ctx.beginPath();
          ctx.arc(tcx, tcy, TR, 0, Math.PI * 2);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        iconX += ICON_SIZE;
      }

      // Comment column
      if (parent.comment) {
        ctx.fillStyle = '#111111';
        ctx.font = `11px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        drawTextClipped(ctx, parent.comment, COL_TIME + COL_COST + COL_EX + PAD_H, midY, COL_COMMENT - PAD_H * 2);
      }
    } else if (entry.kind === 'comment') {
      ctx.fillStyle = '#111111';
      ctx.font = `12px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      drawTextClipped(ctx, entry.text, COL_TIME + COL_COST + COL_EX + PAD_H, midY, COL_COMMENT - PAD_H * 2);
    } else if (entry.kind === 'kill') {
      ctx.fillStyle = '#111111';
      ctx.font = `12px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('撃破', COL_TIME + COL_COST + COL_EX + PAD_H, midY);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png'
    );
  });
}
