import type { TimelineItem, StudentDrop } from '../types';

export const ACTIVE_SLOTS = 3;
export const EXTENDED_ACTIVE_SLOTS = 5;

/** キュー初期化の共通処理 */
function buildInitialQueue(
  queueOrder: number[] | undefined,
  filledSlotIndices: number[]
): number[] {
  const base = queueOrder ?? filledSlotIndices;
  const filtered = base.filter(i => filledSlotIndices.includes(i));
  const missing = filledSlotIndices.filter(i => !filtered.includes(i));
  return [...filtered, ...missing];
}

type QueueEvent =
  | { kind: 'skill'; timeMs: number; item: TimelineItem; idx: number }
  | { kind: 'drop'; timeMs: number; slotIndex: number; idx: number };

/**
 * スキル使用・落とし生徒をゲーム時間順（timeMs降順）に並べる。
 * 同時刻はスキル使用 → 落としの順、スキル同士は配列インデックス昇順（即チェーンの親→子）。
 */
function sortEvents(items: TimelineItem[], filledSlotIndices: number[], drops: StudentDrop[] = []): QueueEvent[] {
  const events: QueueEvent[] = [
    ...items
      .map((item, idx) => ({ kind: 'skill' as const, timeMs: item.timeMs, item, idx }))
      .filter(({ item }) => filledSlotIndices.includes(item.slotIndex)),
    ...drops
      .filter((d) => filledSlotIndices.includes(d.slotIndex))
      .map((d, idx) => ({ kind: 'drop' as const, timeMs: d.timeMs, slotIndex: d.slotIndex, idx })),
  ];
  return events.sort((a, b) => {
    const dt = b.timeMs - a.timeMs;
    if (dt !== 0) return dt;
    if (a.kind !== b.kind) return a.kind === 'skill' ? -1 : 1;
    return a.idx - b.idx;
  });
}

/**
 * 生徒が落ちたときのキュー更新。
 * 落ちた生徒のカードを取り除き、アクティブ枠にあった場合はその位置に次の待機カードを入れる（末尾には戻らない）。
 */
function applyDrop(queue: number[], slotIndex: number, activeSlots: number): void {
  const pos = queue.indexOf(slotIndex);
  if (pos === -1) return;
  queue.splice(pos, 1);
  if (pos < activeSlots && queue.length >= activeSlots) {
    // 待機先頭（activeSlots-1番目にずれてきたカード）を落ちた位置に入れる
    const nextWaiting = queue[activeSlots - 1];
    queue.splice(activeSlots - 1, 1);
    queue.splice(pos, 0, nextWaiting);
  }
}

/**
 * スキル使用後のキュー状態を更新する（ゲーム正確な挙動）。
 * 使用されたスロット位置に次の待機キャラが入り、他のアクティブスロットは変化しない。
 */
function applySkillUse(queue: number[], pos: number, usedSlot: number, activeSlots: number): void {
  if (pos < activeSlots && queue.length > activeSlots) {
    // 使用されたスロットを取り除く
    queue.splice(pos, 1);
    // 最初の待機キャラ（activeSlots-1番目）を取り出す
    const nextWaiting = queue[activeSlots - 1];
    queue.splice(activeSlots - 1, 1);
    // 使用されたスロットの位置に待機キャラを挿入
    queue.splice(pos, 0, nextWaiting);
    // 使用されたスロットを末尾に追加
    queue.push(usedSlot);
  } else {
    queue.splice(pos, 1);
    queue.push(usedSlot);
  }
}

/**
 * 再生位置（untilMs）時点のキュー状態を返す。
 * untilMs 以前（戦闘時間で先 = timeMs >= untilMs）のスキル使用・落としのみ反映する。
 * untilMs 省略時は全TLアイテムを処理した後の状態。
 * 先頭 activeSlots 個がアクティブスロット（呼び出し側でスライス）。
 */
export function computeCurrentQueueState(
  items: TimelineItem[],
  queueOrder: number[] | undefined,
  filledSlotIndices: number[],
  activeSlots: number = ACTIVE_SLOTS,
  drops: StudentDrop[] = [],
  untilMs?: number
): number[] {
  const queue = buildInitialQueue(queueOrder, filledSlotIndices);
  for (const ev of sortEvents(items, filledSlotIndices, drops)) {
    if (untilMs !== undefined && ev.timeMs < untilMs) break;
    if (ev.kind === 'drop') {
      applyDrop(queue, ev.slotIndex, activeSlots);
      continue;
    }
    const pos = queue.indexOf(ev.item.slotIndex);
    if (pos === -1) continue;
    applySkillUse(queue, pos, ev.item.slotIndex, activeSlots);
  }
  return queue;
}

/**
 * スキルキュー検証
 * TLアイテムをゲーム時間順（timeMs降順）にシミュレーションし、
 * アクティブスロット外から使用されたアイテムのIDをエラーとして返す。
 *
 * @param items - 全TLアイテム（配列順が即チェーンの親→子順を表す）
 * @param queueOrder - スキル使用順（slotIndexの配列）。undefined = スロット番号順
 * @param filledSlotIndices - キャラが設定されているスロットのインデックス一覧
 * @param activeSlots - アクティブスロット数（通常3、制約解除決戦5）
 * @param drops - 落とし生徒（落ちた後のその生徒のスキルはエラー）
 */
export function validateSkillQueue(
  items: TimelineItem[],
  queueOrder: number[] | undefined,
  filledSlotIndices: number[],
  activeSlots: number = ACTIVE_SLOTS,
  drops: StudentDrop[] = []
): Set<string> {
  if (items.length === 0) return new Set();
  // 落としがない場合、編成人数がアクティブ数以下ならキュー制約は発生しない
  if (drops.length === 0 && filledSlotIndices.length <= activeSlots) {
    return new Set();
  }

  const queue = buildInitialQueue(queueOrder, filledSlotIndices);
  const errorIds = new Set<string>();
  const dropped = new Set<number>();

  for (const ev of sortEvents(items, filledSlotIndices, drops)) {
    if (ev.kind === 'drop') {
      dropped.add(ev.slotIndex);
      applyDrop(queue, ev.slotIndex, activeSlots);
      continue;
    }
    const item = ev.item;
    // 落ちた生徒のスキルは使用不可
    if (dropped.has(item.slotIndex)) {
      errorIds.add(item.id);
      continue;
    }
    const pos = queue.indexOf(item.slotIndex);
    if (pos === -1) continue;

    if (pos >= Math.min(activeSlots, queue.length)) {
      errorIds.add(item.id);
    }

    applySkillUse(queue, pos, item.slotIndex, activeSlots);
  }

  return errorIds;
}
