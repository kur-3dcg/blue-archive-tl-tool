import type { TimelineState } from '../types';
import { calculateItemCosts, computeArmorCounts } from './costCalc';
import { msToDisplay, costToDisplay } from './timeFormat';
import etcData from '../../data/etc.json';

// ---------------------------------------------------------------------------
// CRC-32 & minimal STORE ZIP builder (no external dependency)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nb = enc.encode(name);
    const crc = crc32(data);
    const sz = data.length;

    // Local file header (30 bytes + filename)
    const lh = new Uint8Array(30 + nb.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true);          // version needed
    // flags, compression(STORE), mod time, mod date = 0
    lv.setUint32(14, crc, true);
    lv.setUint32(18, sz, true);         // compressed size
    lv.setUint32(22, sz, true);         // uncompressed size
    lv.setUint16(26, nb.length, true);
    lh.set(nb, 30);
    locals.push(lh, data);

    // Central directory entry (46 bytes + filename)
    const ch = new Uint8Array(46 + nb.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, sz, true);
    cv.setUint32(24, sz, true);
    cv.setUint16(28, nb.length, true);
    cv.setUint32(42, offset, true);     // local header offset
    ch.set(nb, 46);
    central.push(ch);

    offset += lh.length + sz;
  }

  const centralSz = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSz, true);
  ev.setUint32(16, offset, true);

  const all = [...locals, ...central, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}


function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawTextClipped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  if (ctx.measureText(text).width <= maxW) { ctx.fillText(text, x, y); return; }
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  ctx.fillText(t + '…', x, y);
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('toBlob failed')); return; }
      blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
    }, 'image/png');
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

function buildEntries(state: TimelineState) {
  const { slots, items, slotCostConfigs, totalTimeMs, targetTimeMs, standaloneComments, stageGimmicks } = state;

  const { heavyArmorCount, redWinterCount } = computeArmorCounts(slots);
  const costMap = calculateItemCosts(slots, items, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount, stageGimmicks);

  const filteredItems = items.filter(
    (item) => slots[item.slotIndex]?.character && (targetTimeMs === undefined || item.timeMs >= targetTimeMs)
  );
  const sorted = [...filteredItems].sort((a, b) => b.timeMs - a.timeMs);
  const groups: (typeof sorted)[] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0].timeMs === item.timeMs) { last.push(item); } else { groups.push([item]); }
  }
  for (const group of groups) {
    group.sort((a, b) => a.layerIndex !== b.layerIndex ? a.layerIndex - b.layerIndex : items.indexOf(a) - items.indexOf(b));
  }

  const filteredComments = (standaloneComments ?? []).filter(
    (sc) => targetTimeMs === undefined || sc.timeMs >= targetTimeMs
  );

  const entries: Array<
    | { kind: 'comment'; timeMs: number; text: string }
    | { kind: 'skill'; timeMs: number; group: typeof sorted }
    | { kind: 'kill'; timeMs: number }
  > = [
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

  return { entries, costMap, slots };
}

export async function generateTlImagePaged(
  state: TimelineState,
  options: { rowsPerPage: number }
): Promise<Blob> {
  const { rowsPerPage } = options;
  const { entries, costMap, slots } = buildEntries(state);

  // Pre-load all images
  const imageUrls = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== 'skill') continue;
    for (const item of entry.group) {
      const char = slots[item.slotIndex]?.character;
      const img = (item.skillIndex ? char?.skills?.[item.skillIndex]?.image : undefined) ?? char?.image;
      if (img) imageUrls.add(img);
      if (item.targetSlotIndex !== undefined) {
        const tImg = slots[item.targetSlotIndex]?.character?.image;
        if (tImg) imageUrls.add(tImg);
      }
      if (item.targetEtcIcon) {
        const etcImg = (etcData as { name: string; image: string }[]).find((e) => e.name === item.targetEtcIcon);
        if (etcImg?.image) imageUrls.add(etcImg.image);
      }
    }
  }
  const imageCache = new Map<string, HTMLImageElement | null>();
  await Promise.all([...imageUrls].map(async (url) => { imageCache.set(url, await loadImage(url)); }));

  // Layout constants (1920×1080, white background)
  const PAGE_W = 1920;
  const PAGE_H = 1080;
  const HEADER_H = 50;
  const PAD_H = 20;
  const ROW_H = Math.floor((PAGE_H - HEADER_H) / rowsPerPage);
  const ICON_SIZE = Math.round(ROW_H * 0.72);
  const ARROW_W = Math.round(ICON_SIZE * 0.55);
  const FONT_MAIN = Math.max(16, Math.round(ROW_H * 0.36));
  const FONT_COMMENT = Math.max(14, Math.round(ROW_H * 0.30));
  const FONT_HEADER = Math.round(HEADER_H * 0.44);

  let maxGroupSize = 1;
  for (const entry of entries) {
    if (entry.kind === 'skill') maxGroupSize = Math.max(maxGroupSize, entry.group.length);
  }
  const COL_TIME = Math.round(PAGE_W * 0.068);
  const COL_COST = Math.round(PAGE_W * 0.058);
  const COL_EX = maxGroupSize * ICON_SIZE + Math.max(0, maxGroupSize - 1) * ARROW_W + PAD_H * 2;
  const COL_COMMENT = PAGE_W - COL_TIME - COL_COST - COL_EX;

  // Split into pages
  const pages: typeof entries[] = [];
  for (let i = 0; i < Math.max(1, entries.length); i += rowsPerPage) {
    pages.push(entries.slice(i, i + rowsPerPage));
  }

  const renderPage = async (pageEntries: typeof entries, pageIdx: number): Promise<Uint8Array> => {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // Header background
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, PAGE_W, HEADER_H);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, HEADER_H - 1, PAGE_W, 1);

    // Page number (top right)
    ctx.fillStyle = '#666666';
    ctx.font = `${FONT_HEADER}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(`${pageIdx + 1} / ${pages.length}`, PAGE_W - PAD_H, HEADER_H / 2);

    // Column headers
    ctx.fillStyle = '#111111';
    ctx.font = `bold ${FONT_HEADER}px sans-serif`;
    ctx.textAlign = 'left';
    for (const [text, x] of [
      ['時間', PAD_H],
      ['コスト', COL_TIME + PAD_H],
      ['EX', COL_TIME + COL_COST + PAD_H],
      ['コメント', COL_TIME + COL_COST + COL_EX + PAD_H],
    ] as [string, number][]) {
      ctx.fillText(text, x, HEADER_H / 2);
    }

    // Rows
    for (let i = 0; i < pageEntries.length; i++) {
      const entry = pageEntries[i];
      const rowY = HEADER_H + i * ROW_H;
      const midY = rowY + ROW_H / 2;

      // Alternating row tint
      if (i % 2 === 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        ctx.fillRect(0, rowY, PAGE_W, ROW_H);
      }
      // Row separator
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, rowY + ROW_H - 1, PAGE_W, 1);

      // Time
      ctx.fillStyle = '#111111';
      ctx.font = `${FONT_MAIN}px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(msToDisplay(entry.timeMs), PAD_H, midY);

      if (entry.kind === 'skill') {
        const [parent] = entry.group;
        const costInfo = costMap.get(parent.id);
        const costStr = costInfo !== undefined ? costToDisplay(costInfo.usedCost) : '';
        const isOverrun = costInfo?.isOverrun ?? false;

        // Cost
        ctx.fillStyle = isOverrun ? '#cc2200' : '#111111';
        ctx.font = `${FONT_MAIN}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(costStr, COL_TIME + PAD_H, midY);

        // Icons
        let iconX = COL_TIME + COL_COST + PAD_H;
        const iconY = rowY + (ROW_H - ICON_SIZE) / 2;
        const radius = Math.round(ICON_SIZE * 0.12);
        const badgeR = Math.round(ICON_SIZE * 0.22);
        const badgeLW = Math.max(1.5, Math.round(ICON_SIZE * 0.05));

        for (let j = 0; j < entry.group.length; j++) {
          if (j > 0) {
            ctx.fillStyle = '#333333';
            ctx.font = `${FONT_MAIN}px sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.fillText('→', iconX + ARROW_W / 2, midY);
            iconX += ARROW_W;
          }
          const item = entry.group[j];
          const pagedChar = slots[item.slotIndex]?.character;
          const pagedImgUrl = (item.skillIndex ? pagedChar?.skills?.[item.skillIndex]?.image : undefined) ?? pagedChar?.image ?? '';
          const imgEl = imageCache.get(pagedImgUrl);

          ctx.save();
          roundedRectPath(ctx, iconX, iconY, ICON_SIZE, ICON_SIZE, radius);
          ctx.clip();
          if (imgEl) {
            ctx.drawImage(imgEl, iconX, iconY, ICON_SIZE, ICON_SIZE);
          } else {
            ctx.fillStyle = 'rgba(180,180,180,0.5)';
            ctx.fillRect(iconX, iconY, ICON_SIZE, ICON_SIZE);
            ctx.fillStyle = '#333';
            ctx.font = `${Math.round(ICON_SIZE * 0.35)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(slots[item.slotIndex]?.character?.name?.[0] ?? '?', iconX + ICON_SIZE / 2, iconY + ICON_SIZE / 2);
          }
          ctx.restore();

          // Target slot badge (top-right)
          if (item.targetSlotIndex !== undefined) {
            const tImgEl = imageCache.get(slots[item.targetSlotIndex]?.character?.image ?? '');
            const tcx = iconX + ICON_SIZE - badgeR + 2;
            const tcy = iconY + badgeR - 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(tcx, tcy, badgeR, 0, Math.PI * 2);
            ctx.clip();
            if (tImgEl) ctx.drawImage(tImgEl, tcx - badgeR, tcy - badgeR, badgeR * 2, badgeR * 2);
            else { ctx.fillStyle = 'rgba(180,180,180,0.7)'; ctx.fill(); }
            ctx.restore();
            ctx.beginPath();
            ctx.arc(tcx, tcy, badgeR, 0, Math.PI * 2);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = badgeLW;
            ctx.stroke();
          }

          // Etc icon badge (top-left)
          if (item.targetEtcIcon) {
            const etcMeta = (etcData as { name: string; image: string }[]).find((e) => e.name === item.targetEtcIcon);
            const eImgEl = etcMeta?.image ? imageCache.get(etcMeta.image) : undefined;
            const ecx = iconX + badgeR - 2;
            const ecy = iconY + badgeR - 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(ecx, ecy, badgeR, 0, Math.PI * 2);
            ctx.clip();
            if (eImgEl) ctx.drawImage(eImgEl, ecx - badgeR, ecy - badgeR, badgeR * 2, badgeR * 2);
            else { ctx.fillStyle = 'rgba(180,180,180,0.7)'; ctx.fill(); }
            ctx.restore();
            ctx.beginPath();
            ctx.arc(ecx, ecy, badgeR, 0, Math.PI * 2);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = badgeLW;
            ctx.stroke();
          }

          iconX += ICON_SIZE;
        }

        // Comment
        if (parent.comment) {
          ctx.fillStyle = '#111111';
          ctx.font = `${FONT_COMMENT}px sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          drawTextClipped(ctx, parent.comment, COL_TIME + COL_COST + COL_EX + PAD_H, midY, COL_COMMENT - PAD_H * 2);
        }
      } else if (entry.kind === 'comment') {
        ctx.fillStyle = '#117733';
        ctx.font = `${FONT_COMMENT}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        drawTextClipped(ctx, entry.text, COL_TIME + COL_COST + COL_EX + PAD_H, midY, COL_COMMENT - PAD_H * 2);
      } else if (entry.kind === 'kill') {
        ctx.fillStyle = '#cc2200';
        ctx.font = `bold ${FONT_MAIN}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText('撃破', COL_TIME + COL_COST + COL_EX + PAD_H, midY);
      }
    }

    return canvasToPngBytes(canvas);
  };

  // Render all pages (parallel)
  const pageData = await Promise.all(pages.map((pe, i) => renderPage(pe, i)));

  // Pack into ZIP
  const zipFiles = pageData.map((data, i) => ({
    name: `page${String(i + 1).padStart(2, '0')}.png`,
    data,
  }));
  const zipBytes = buildZip(zipFiles);
  return new Blob([zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer], { type: 'application/zip' });
}
