import type { TimelineItem } from '../types';

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

/** アイテムを時間降順・同時刻は配列インデックス昇順でソート */
function sortItems(items: TimelineItem[], filledSlotIndices: number[]) {
  return items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => filledSlotIndices.includes(item.slotIndex))
    .sort((a, b) => {
      const dt = b.item.timeMs - a.item.timeMs;
      return dt !== 0 ? dt : a.idx - b.idx;
    });
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
 * 全TLアイテムを処理した後の現在のキュー状態を返す。
 * 先頭 activeSlots 個がアクティブスロット（呼び出し側でスライス）。
 */
export function computeCurrentQueueState(
  items: TimelineItem[],
  queueOrder: number[] | undefined,
  filledSlotIndices: number[],
  activeSlots: number = ACTIVE_SLOTS
): number[] {
  const queue = buildInitialQueue(queueOrder, filledSlotIndices);
  for (const { item } of sortItems(items, filledSlotIndices)) {
    const pos = queue.indexOf(item.slotIndex);
    if (pos === -1) continue;
    applySkillUse(queue, pos, item.slotIndex, activeSlots);
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
 */
export function validateSkillQueue(
  items: TimelineItem[],
  queueOrder: number[] | undefined,
  filledSlotIndices: number[],
  activeSlots: number = ACTIVE_SLOTS
): Set<string> {
  if (items.length === 0 || filledSlotIndices.length <= activeSlots) {
    return new Set();
  }

  const queue = buildInitialQueue(queueOrder, filledSlotIndices);
  const errorIds = new Set<string>();

  for (const { item } of sortItems(items, filledSlotIndices)) {
    const pos = queue.indexOf(item.slotIndex);
    if (pos === -1) continue;

    if (pos >= Math.min(activeSlots, queue.length)) {
      errorIds.add(item.id);
    }

    applySkillUse(queue, pos, item.slotIndex, activeSlots);
  }

  return errorIds;
}
