import type { CharacterSlot, TimelineItem, SlotCostConfig } from '../types';
import { STRIKER_COUNT } from '../constants';

// コスト回復開始遅延（戦闘開始から2.033秒後に回復開始）
const RECOVERY_DELAY_MS = 2033;

/**
 * 区間 [fromTimeMs, toTimeMs]（カウントダウン方向: from > to）で
 * 実際にコスト回復が発生する時間(ms)を返す。
 * 回復は totalTimeMs - RECOVERY_DELAY_MS 以降のみ有効。
 */
function getEffectiveRecoveryMs(
  fromTimeMs: number,
  toTimeMs: number,
  recoveryStartMs: number
): number {
  // recoveryStartMs = totalTimeMs - RECOVERY_DELAY_MS（回復開始のタイムライン時間）
  // fromTimeMs > toTimeMs（カウントダウン方向）
  // 回復は recoveryStartMs 以下の時間で発生
  const effectiveFrom = Math.min(fromTimeMs, recoveryStartMs);
  const effectiveTo = toTimeMs;
  return Math.max(0, effectiveFrom - effectiveTo);
}

// SS自動判定対象（SPスロットのみ、重複不可）: 1.202倍
const COST_RECOVERY_SS_NAMES = [
  'ヒマリ', 'キサキ', 'ハルカ（正月）', 'シロコ（水着）',
  'ミチル（ドレス）', 'ヒマリ（臨戦）', 'ニヤ',
];

// チェリノSS: +511 + レッドウィンター1人あたり+146（最大3人）
const CHERINO_NAMES = ['チェリノ', 'チェリノ（温泉）'];

// カノエSS: +342 + 重装甲ストライカー1人あたり+85（最大3人）
const KANOE_NAME = 'カノエ';

// シュンNS: 戦闘開始時にコスト+3.8
const SHUN_NAME = 'シュン';

// EXバフキャラ
const HOSHINO_SWIMSUIT = 'ホシノ（水着）';  // +684, 50秒
const HIFUMI = 'ヒフミ';                    // +1861, 5秒
const SEIA = 'セイア';                      // +718, 15秒
const KURUMI = 'クルミ';                    // SS: +183常時, EX: +854, 10秒
const SUZUMI_MAGICAL = 'スズミ（マジカル）'; // SS: +690, 35秒（EX起点）
const NOA_PAJAMA = 'ノア（パジャマ）';      // NS: +803, 30秒（EX2回→5回→8回...起点）
const YUKARI_SWIMSUIT = 'ユカリ（水着）';   // SS: +1259, 10秒（EX2回ごと）
const REIJO = 'レイジョ';                   // SS: +1861, 5秒（EX毎回）

interface CostEvent {
  timeMs: number;       // タイムラインの時間位置（カウントダウン方向）
  type: 'skill_use' | 'buff_start' | 'buff_end';
  itemId?: string;
  skillCost?: number;
  recoveryDelta?: number;  // バフによる回復力変化量
  costAdjustment?: number; // 手動コスト調整
}

/**
 * コスト上限を計算
 * 基本10 + 0.5 × 固有4チェック済みSP生徒数
 */
export function calculateCostCap(slotCostConfigs: SlotCostConfig[]): number {
  let cap = 10;
  // SPスロットは index 4,5 (STRIKER_COUNT以降)
  for (let i = STRIKER_COUNT; i < slotCostConfigs.length; i++) {
    if (slotCostConfigs[i].hasUniqueWeapon4) {
      cap += 0.5;
    }
  }
  return cap;
}

/**
 * パーティ構成からベース回復力と乗数を算出
 */
function getBaseRecovery(
  slots: CharacterSlot[],
  heavyArmorCount: number,
  redWinterCount: number
): { baseSum: number; multiplier: number } {
  const BASE_PER_CHAR = 700;
  const TOTAL_MEMBERS = 6;
  let baseSum = BASE_PER_CHAR * TOTAL_MEMBERS;
  let multiplier = 1;

  // チェリノSS: +511 + レッドウィンター1人あたり+146（最大3人）
  const hasCherino = slots.some(
    (s) => s.character && CHERINO_NAMES.includes(s.character.name)
  );
  if (hasCherino) {
    baseSum += 511 + 146 * Math.min(3, redWinterCount);
  }

  // カノエSS: +342 + 重装甲ストライカー1人あたり+85（最大3人）
  const hasKanoe = slots.some(
    (s) => s.character && s.character.name === KANOE_NAME
  );
  if (hasKanoe) {
    baseSum += 342 + 85 * Math.min(3, heavyArmorCount);
  }

  // クルミSS: +183（常時）
  const hasKurumi = slots.some(
    (s) => s.character && s.character.name === KURUMI
  );
  if (hasKurumi) {
    baseSum += 183;
  }

  // SP SSキャラがいるか（SPスロットのみ、重複不可）
  const hasSS = slots.some(
    (s) =>
      s.type === 'special' &&
      s.character &&
      COST_RECOVERY_SS_NAMES.includes(s.character.name)
  );
  if (hasSS) {
    multiplier = 1.202;
  }

  return { baseSum, multiplier };
}

/**
 * 特定スロットのキャラがEXバフキャラかを判定し、バフパ���メータを返す
 * countTrigger: N回目のEX使用ごとに発動（デフォルト1=毎回）
 */
interface ExBuffInfo {
  recoveryDelta: number;
  durationMs: number;
  countTrigger?: number; // N回EX使用ごとに発動（undefined=毎回）
  firstTrigger?: number; // 初回発動に必要なEX回数（デフォルト=countTrigger）
}

function getExBuffParams(charName: string): ExBuffInfo | null {
  if (charName === HOSHINO_SWIMSUIT) return { recoveryDelta: 684, durationMs: 50000 };
  if (charName === HIFUMI) return { recoveryDelta: 1861, durationMs: 5000 };
  if (charName === SEIA) return { recoveryDelta: 718, durationMs: 15000 };
  if (charName === KURUMI) return { recoveryDelta: 854, durationMs: 10000 };
  if (charName === SUZUMI_MAGICAL) return { recoveryDelta: 690, durationMs: 35000 };
  // ノア���パジャマ）: 初回2回目、以降3回ごと（2→5→8→...）
  if (charName === NOA_PAJAMA) return { recoveryDelta: 803, durationMs: 30000, countTrigger: 3, firstTrigger: 2 };
  // ユカリ（水着）: 2回ごと（2,4,6,...）
  if (charName === YUKARI_SWIMSUIT) return { recoveryDelta: 1259, durationMs: 10000, countTrigger: 2 };
  // レイジョ: 毎回
  if (charName === REIJO) return { recoveryDelta: 1861, durationMs: 5000 };
  return null;
}

/**
 * countTrigger付きバフの発動判定
 */
function checkBuffTrigger(
  buffParams: ExBuffInfo,
  item: TimelineItem,
  slotItemsSorted: Map<number, TimelineItem[]>
): boolean {
  if (!buffParams.countTrigger) return true; // 毎回発動
  const sorted = slotItemsSorted.get(item.slotIndex) ?? [];
  const useIndex = sorted.indexOf(item) + 1; // 1-based
  const firstTrigger = buffParams.firstTrigger ?? buffParams.countTrigger;
  if (useIndex === firstTrigger) return true;
  if (useIndex > firstTrigger && (useIndex - firstTrigger) % buffParams.countTrigger === 0) return true;
  return false;
}

export interface ItemCostInfo {
  cost: number;       // 使用時の残りコスト
  isOverrun: boolean; // コスト不足（残りコスト < スキルコスト）
}

/**
 * 全アイテムのコスト値を計算
 *
 * タイムラインは左が最大時間、右が0:00のカウントダウン方向。
 * コスト計算は戦闘開始（=totalTimeMs）→0:00方向に進行。
 * 初期コスト0から時間経過で回復、スキル使用で減少。
 */
export function calculateItemCosts(
  slots: CharacterSlot[],
  items: TimelineItem[],
  slotCostConfigs: SlotCostConfig[],
  totalTimeMs: number,
  heavyArmorCount = 0,
  redWinterCount = 0
): Map<string, ItemCostInfo> {
  const result = new Map<string, ItemCostInfo>();
  if (items.length === 0) return result;

  const costCap = calculateCostCap(slotCostConfigs);
  const { baseSum, multiplier } = getBaseRecovery(slots, heavyArmorCount, redWinterCount);

  // イベントリストを構築
  const events: CostEvent[] = [];

  // シュンNS: 戦闘開始2.033秒後にコスト+3.8
  const hasShun = slots.some((s) => s.character && s.character.name === SHUN_NAME);

  // スロットごとのEX使用回数をトラッキング（countTrigger用）
  const slotItemsSorted = new Map<number, TimelineItem[]>();
  for (const item of items) {
    const arr = slotItemsSorted.get(item.slotIndex) ?? [];
    arr.push(item);
    slotItemsSorted.set(item.slotIndex, arr);
  }
  for (const arr of slotItemsSorted.values()) {
    arr.sort((a, b) => b.timeMs - a.timeMs); // 時間降順=戦闘開始順
  }

  for (const item of items) {
    const slot = slots[item.slotIndex];
    const config = slotCostConfigs[item.slotIndex];
    if (!slot?.character) continue;

    events.push({
      timeMs: item.timeMs,
      type: 'skill_use',
      itemId: item.id,
      skillCost: config?.skillCost ?? 3,
      costAdjustment: item.costAdjustment ?? 0,
    });

    const buffParams = getExBuffParams(slot.character.name);
    if (buffParams) {
      const shouldTrigger = checkBuffTrigger(buffParams, item, slotItemsSorted);
      if (shouldTrigger) {
        events.push({
          timeMs: item.timeMs,
          type: 'buff_start',
          recoveryDelta: buffParams.recoveryDelta,
        });
        const endTimeMs = Math.max(0, item.timeMs - buffParams.durationMs);
        events.push({
          timeMs: endTimeMs,
          type: 'buff_end',
          recoveryDelta: buffParams.recoveryDelta,
        });
      }
    }
  }

  // 時間降順でソート（totalTimeMs → 0方向）、同一時間ならbuff_start → skill_use → buff_end
  const typePriority = { buff_start: 0, skill_use: 1, buff_end: 2 };
  events.sort((a, b) => {
    if (b.timeMs !== a.timeMs) return b.timeMs - a.timeMs;
    return typePriority[a.type] - typePriority[b.type];
  });

  // セグメントごとにコスト計算
  let currentCost = 0;
  let currentTimeMs = totalTimeMs; // 戦闘開始位置
  let activeBuffDelta = 0; // 現在のバフによる追加回復力
  const recoveryStartMs = totalTimeMs - RECOVERY_DELAY_MS; // 回復開始タイムライン時間
  let shunApplied = false;

  for (const event of events) {
    // このイベントまでの経過時間でコスト回復（遅延考慮）
    const effectiveMs = getEffectiveRecoveryMs(currentTimeMs, event.timeMs, recoveryStartMs);
    if (effectiveMs > 0) {
      const recoveryPerSec = (baseSum + activeBuffDelta) * multiplier / 10000;
      const recovered = recoveryPerSec * (effectiveMs / 1000);
      currentCost = Math.min(costCap, currentCost + recovered);
    }
    // シュンNS: 回復開始地点（recoveryStartMs）を通過したらコスト+3.8
    if (hasShun && !shunApplied && currentTimeMs >= recoveryStartMs && event.timeMs <= recoveryStartMs) {
      currentCost = Math.min(costCap, currentCost + 3.8);
      shunApplied = true;
    }

    currentTimeMs = event.timeMs;

    switch (event.type) {
      case 'buff_start':
        activeBuffDelta += event.recoveryDelta!;
        break;
      case 'buff_end':
        activeBuffDelta -= event.recoveryDelta!;
        break;
      case 'skill_use': {
        const baseSkillCost = event.skillCost ?? 3;
        const adjustedSkillCost = Math.max(0, Math.min(10, baseSkillCost + (event.costAdjustment ?? 0)));
        const isOverrun = currentCost < adjustedSkillCost;
        result.set(event.itemId!, { cost: currentCost, isOverrun });
        currentCost = Math.max(0, currentCost - adjustedSkillCost);
        break;
      }
    }
  }

  return result;
}

/**
 * コストの時系列キーポイントを計算（グラフ描画用）
 *
 * 戦闘開始(totalTimeMs)からタイムライン0:00方向へ進行。
 * 各ポイントは { timeMs, cost } で、直線補間で繋がる。
 * スキル使用時は同一timeMsに2点（使用前/使用後）を挿入。
 */
export interface CostKeypoint {
  timeMs: number;
  cost: number;
  isOverrun?: boolean; // コスト不足区間
}

export function calculateCostTimeline(
  slots: CharacterSlot[],
  items: TimelineItem[],
  slotCostConfigs: SlotCostConfig[],
  totalTimeMs: number,
  heavyArmorCount = 0,
  redWinterCount = 0
): CostKeypoint[] {
  const costCap = calculateCostCap(slotCostConfigs);
  const { baseSum, multiplier } = getBaseRecovery(slots, heavyArmorCount, redWinterCount);
  const keypoints: CostKeypoint[] = [];

  const hasShun = slots.some((s) => s.character && s.character.name === SHUN_NAME);

  // イベントリストを構築
  const events: CostEvent[] = [];

  const slotItemsSorted = new Map<number, TimelineItem[]>();
  for (const item of items) {
    const arr = slotItemsSorted.get(item.slotIndex) ?? [];
    arr.push(item);
    slotItemsSorted.set(item.slotIndex, arr);
  }
  for (const arr of slotItemsSorted.values()) {
    arr.sort((a, b) => b.timeMs - a.timeMs);
  }

  for (const item of items) {
    const slot = slots[item.slotIndex];
    const config = slotCostConfigs[item.slotIndex];
    if (!slot?.character) continue;

    events.push({
      timeMs: item.timeMs,
      type: 'skill_use',
      itemId: item.id,
      skillCost: config?.skillCost ?? 3,
      costAdjustment: item.costAdjustment ?? 0,
    });

    const buffParams = getExBuffParams(slot.character.name);
    if (buffParams) {
      const shouldTrigger = checkBuffTrigger(buffParams, item, slotItemsSorted);
      if (shouldTrigger) {
        events.push({
          timeMs: item.timeMs,
          type: 'buff_start',
          recoveryDelta: buffParams.recoveryDelta,
        });
        const endTimeMs = Math.max(0, item.timeMs - buffParams.durationMs);
        events.push({
          timeMs: endTimeMs,
          type: 'buff_end',
          recoveryDelta: buffParams.recoveryDelta,
        });
      }
    }
  }

  const typePriority = { buff_start: 0, skill_use: 1, buff_end: 2 };
  events.sort((a, b) => {
    if (b.timeMs !== a.timeMs) return b.timeMs - a.timeMs;
    return typePriority[a.type] - typePriority[b.type];
  });

  let currentCost = 0;
  let currentTimeMs = totalTimeMs;
  let activeBuffDelta = 0;
  const recoveryStartMs = totalTimeMs - RECOVERY_DELAY_MS;
  let shunApplied = false;

  // 開始点
  keypoints.push({ timeMs: totalTimeMs, cost: 0 });

  // 回復開始地点をキーポイントとして挿入（遅延区間の終わり）
  if (recoveryStartMs > 0) {
    // 回復開始前にイベントがなければ、ここでコスト=0のポイントを挿入
    const firstEventTime = events.length > 0 ? events[0].timeMs : -1;
    if (firstEventTime < recoveryStartMs) {
      keypoints.push({ timeMs: recoveryStartMs, cost: 0 });
    }
  }

  for (const event of events) {
    const effectiveMs = getEffectiveRecoveryMs(currentTimeMs, event.timeMs, recoveryStartMs);
    if (effectiveMs > 0) {
      const recoveryPerSec = (baseSum + activeBuffDelta) * multiplier / 10000;
      const recovered = recoveryPerSec * (effectiveMs / 1000);
      const newCost = Math.min(costCap, currentCost + recovered);

      // 回復開始地点のキーポイント（遅延→回復の境界）
      if (currentTimeMs > recoveryStartMs && event.timeMs < recoveryStartMs) {
        keypoints.push({ timeMs: recoveryStartMs, cost: currentCost });
      }

      // キャップに到達するタイミングを計算
      if (currentCost < costCap && newCost >= costCap && recoveryPerSec > 0) {
        const timeToCapSec = (costCap - currentCost) / recoveryPerSec;
        const capFromMs = Math.min(currentTimeMs, recoveryStartMs);
        const capTimeMs = capFromMs - timeToCapSec * 1000;
        if (capTimeMs > event.timeMs) {
          keypoints.push({ timeMs: capTimeMs, cost: costCap });
        }
      }

      currentCost = newCost;
    } else {
      // 回復なし区間でも境界ポイントは記録
      if (currentTimeMs > recoveryStartMs && event.timeMs <= recoveryStartMs) {
        keypoints.push({ timeMs: recoveryStartMs, cost: currentCost });
      }
    }
    // シュンNS: 回復開始地点（recoveryStartMs）を通過したらコスト+3.8
    if (hasShun && !shunApplied && currentTimeMs >= recoveryStartMs && event.timeMs <= recoveryStartMs) {
      keypoints.push({ timeMs: recoveryStartMs, cost: currentCost });
      currentCost = Math.min(costCap, currentCost + 3.8);
      keypoints.push({ timeMs: recoveryStartMs, cost: currentCost });
      shunApplied = true;
    }
    currentTimeMs = event.timeMs;

    switch (event.type) {
      case 'buff_start':
        keypoints.push({ timeMs: event.timeMs, cost: currentCost });
        activeBuffDelta += event.recoveryDelta!;
        break;
      case 'buff_end':
        keypoints.push({ timeMs: event.timeMs, cost: currentCost });
        activeBuffDelta -= event.recoveryDelta!;
        break;
      case 'skill_use': {
        const baseSkillCost = event.skillCost ?? 3;
        const adjustedSkillCost = Math.max(0, Math.min(10, baseSkillCost + (event.costAdjustment ?? 0)));
        const overrun = currentCost < adjustedSkillCost;
        keypoints.push({ timeMs: event.timeMs, cost: currentCost, isOverrun: overrun || undefined });
        currentCost = Math.max(0, currentCost - adjustedSkillCost);
        keypoints.push({ timeMs: event.timeMs, cost: currentCost, isOverrun: overrun || undefined });
        break;
      }
    }
  }

  // シュンNS: ループ後に回復開始地点を通過していない場合
  if (hasShun && !shunApplied && currentTimeMs >= recoveryStartMs && recoveryStartMs > 0) {
    keypoints.push({ timeMs: recoveryStartMs, cost: currentCost });
    currentCost = Math.min(costCap, currentCost + 3.8);
    keypoints.push({ timeMs: recoveryStartMs, cost: currentCost });
    shunApplied = true;
  }

  // 最後のイベントから0:00まで回復（遅延考慮）
  if (currentTimeMs > 0) {
    const effectiveMs = getEffectiveRecoveryMs(currentTimeMs, 0, recoveryStartMs);
    if (effectiveMs > 0) {
      const recoveryPerSec = (baseSum + activeBuffDelta) * multiplier / 10000;
      const recovered = recoveryPerSec * (effectiveMs / 1000);
      const finalCost = Math.min(costCap, currentCost + recovered);

      // 回復開始境界
      if (currentTimeMs > recoveryStartMs) {
        keypoints.push({ timeMs: recoveryStartMs, cost: currentCost });
      }

      if (currentCost < costCap && finalCost >= costCap && recoveryPerSec > 0) {
        const timeToCapSec = (costCap - currentCost) / recoveryPerSec;
        const capFromMs = Math.min(currentTimeMs, recoveryStartMs);
        const capTimeMs = capFromMs - timeToCapSec * 1000;
        if (capTimeMs > 0) {
          keypoints.push({ timeMs: capTimeMs, cost: costCap });
        }
      }

      keypoints.push({ timeMs: 0, cost: finalCost });
    } else {
      // 全区間が遅延内
      if (currentTimeMs > recoveryStartMs && recoveryStartMs > 0) {
        keypoints.push({ timeMs: recoveryStartMs, cost: currentCost });
      }
      keypoints.push({ timeMs: 0, cost: currentCost });
    }
  } else {
    keypoints.push({ timeMs: 0, cost: currentCost });
  }

  return keypoints;
}
