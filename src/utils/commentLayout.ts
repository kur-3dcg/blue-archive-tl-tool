import type { StandaloneComment, TimelineItem } from '../types';
import { TIMELINE_PAD_RIGHT, STANDALONE_COMMENT_HEIGHT } from '../constants';

// ─────────────────────────────────────────
// フリーコメント（緑バブル）
// ─────────────────────────────────────────

export const STANDALONE_BUBBLE_HEIGHT = 30;
const STANDALONE_MIN_WIDTH = 60;
const STANDALONE_CHAR_WIDTH = 11;
const STANDALONE_PAD_X = 10;
const STANDALONE_ROW_GAP = 4;
const STANDALONE_ROW_STEP = STANDALONE_BUBBLE_HEIGHT + STANDALONE_ROW_GAP;

export function standaloneBubbleWidth(text: string): number {
  return Math.max(STANDALONE_MIN_WIDTH, text.length * STANDALONE_CHAR_WIDTH + STANDALONE_PAD_X * 2);
}

/** 行の占有区間に重ならない最も下の行を探して登録する（row 0 が一番下） */
function placeInRow(rows: { left: number; right: number }[][], left: number, right: number, gap: number): number {
  for (let row = 0; row < rows.length; row++) {
    if (!rows[row].some((r) => left - gap < r.right && right + gap > r.left)) {
      rows[row].push({ left, right });
      return row;
    }
  }
  rows.push([{ left, right }]);
  return rows.length - 1;
}

/**
 * フリーコメントの段積みレイアウト。
 * 重なるバブルは上の行にずらし、行数に応じてエリアの高さを伸ばす（1行なら従来の STANDALONE_COMMENT_HEIGHT）。
 * timeOverrides: ドラッグ中など、表示位置を一時的に差し替えるコメントの時刻
 */
export function layoutStandaloneComments(
  comments: StandaloneComment[],
  zoomLevel: number,
  totalWidth: number,
  timeOverrides?: Map<string, number>
): { tops: Map<string, number>; height: number } {
  const placed = comments
    .map((c) => {
      const timeMs = timeOverrides?.get(c.id) ?? c.timeMs;
      const x = totalWidth - TIMELINE_PAD_RIGHT - (timeMs / 1000) * zoomLevel;
      const w = standaloneBubbleWidth(c.text);
      return { id: c.id, left: x - w / 2, right: x + w / 2 };
    })
    .sort((a, b) => a.left - b.left);

  const rows: { left: number; right: number }[][] = [[]];
  const rowOf = new Map<string, number>();
  for (const p of placed) rowOf.set(p.id, placeInRow(rows, p.left, p.right, STANDALONE_ROW_GAP));

  const height = STANDALONE_COMMENT_HEIGHT + (rows.length - 1) * STANDALONE_ROW_STEP;
  // 一番下の行は従来どおりエリア下部44pxの中央。上の行ほど上にずれる
  const bottomRowTop = height - STANDALONE_COMMENT_HEIGHT + (STANDALONE_COMMENT_HEIGHT - STANDALONE_BUBBLE_HEIGHT) / 2;
  const tops = new Map<string, number>();
  for (const [id, row] of rowOf) tops.set(id, bottomRowTop - row * STANDALONE_ROW_STEP);
  return { tops, height };
}

// ─────────────────────────────────────────
// キャラ依存コメント（黄色吹き出し）
// ─────────────────────────────────────────

export const ITEM_BUBBLE_HEIGHT = 32;
export const ITEM_BUBBLE_GAP = 4;
const ITEM_BUBBLE_MIN_WIDTH = 60;

/** キャラ依存コメントの段積みレイアウト（アイテムごとの行番号とエリアの高さ）。コメントがなければ高さ0 */
export function layoutItemBubbles(
  items: TimelineItem[],
  zoomLevel: number,
  totalWidth: number
): { bubbles: { item: TimelineItem; x: number; row: number }[]; height: number } {
  const commented = items.filter((it) => it.comment);
  if (commented.length === 0) return { bubbles: [], height: 0 };

  const sorted = commented
    .map((item) => ({ item, x: totalWidth - TIMELINE_PAD_RIGHT - (item.timeMs / 1000) * zoomLevel }))
    .sort((a, b) => a.x - b.x);

  const rows: { left: number; right: number }[][] = [[]];
  const bubbles = sorted.map(({ item, x }) => {
    const textWidth = Math.max(ITEM_BUBBLE_MIN_WIDTH, (item.comment?.length ?? 0) * 13 + 20);
    const row = placeInRow(rows, x - textWidth / 2, x + textWidth / 2, ITEM_BUBBLE_GAP);
    return { item, x, row };
  });

  return { bubbles, height: rows.length * (ITEM_BUBBLE_HEIGHT + ITEM_BUBBLE_GAP) + 8 };
}
