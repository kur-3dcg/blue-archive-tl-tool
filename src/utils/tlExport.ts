import type { TimelineState, TimelineItem, CharacterSlot } from '../types';
import { calculateItemCosts, computeArmorCounts } from './costCalc';
import { costToDisplay } from './timeFormat';

function msToMSS(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** キャラ（対象）の形式で1つのエントリを生成 */
function formatEntry(item: TimelineItem, slots: CharacterSlot[]): string {
  const charName = slots[item.slotIndex]?.character?.name ?? '';
  const targetName =
    item.targetSlotIndex !== undefined ? (slots[item.targetSlotIndex]?.character?.name ?? '') : '';
  return targetName ? `${charName}（${targetName}）` : charName;
}

export function generateTlText(state: TimelineState): string {
  const { slots, items, slotCostConfigs, totalTimeMs, targetTimeMs, standaloneComments } = state;

  const { heavyArmorCount, redWinterCount } = computeArmorCounts(slots);
  const costMap = calculateItemCosts(
    slots, items, slotCostConfigs, totalTimeMs, heavyArmorCount, redWinterCount
  );

  // キャラなしスロットのアイテムは除外、targetTimeMs設定時は対象時間以降のみ
  const filteredItems = items.filter(
    (item) =>
      slots[item.slotIndex]?.character &&
      (targetTimeMs === undefined || item.timeMs >= targetTimeMs)
  );

  // 時間降順（戦闘開始側が先）
  const sorted = [...filteredItems].sort((a, b) => b.timeMs - a.timeMs);

  // 同時刻でグループ化
  const groups: typeof sorted[] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0].timeMs === item.timeMs) {
      last.push(item);
    } else {
      groups.push([item]);
    }
  }

  // グループ内のソート: レイヤー番号昇順、同レイヤーは配置順（items配列index）= 先に置いた方が親
  for (const group of groups) {
    group.sort((a, b) => {
      if (a.layerIndex !== b.layerIndex) return a.layerIndex - b.layerIndex;
      return items.indexOf(a) - items.indexOf(b);
    });
  }

  // スタンドアロンコメントのフィルタリング
  const filteredComments = (standaloneComments ?? []).filter(
    (sc) => targetTimeMs === undefined || sc.timeMs >= targetTimeMs
  );

  // 出力エントリを統合: コメントを先、スキルグループを後に（同時刻の場合）
  type Entry =
    | { kind: 'comment'; timeMs: number; text: string }
    | { kind: 'skill'; timeMs: number; group: typeof sorted };

  const entries: Entry[] = [
    ...filteredComments.map((sc) => ({ kind: 'comment' as const, timeMs: sc.timeMs, text: sc.text })),
    ...groups.map((g) => ({ kind: 'skill' as const, timeMs: g[0].timeMs, group: g })),
  ];

  // 時間降順、同時刻はコメントを先にする
  entries.sort((a, b) => {
    if (b.timeMs !== a.timeMs) return b.timeMs - a.timeMs;
    if (a.kind === 'comment' && b.kind !== 'comment') return -1;
    if (b.kind === 'comment' && a.kind !== 'comment') return 1;
    return 0;
  });

  // ヘッダー行
  const rows: string[][] = [['時間', 'コスト', 'EX', 'コメント']];

  for (const entry of entries) {
    if (entry.kind === 'comment') {
      rows.push([msToMSS(entry.timeMs), '', '', entry.text]);
    } else {
      const [parent, ...children] = entry.group;
      const costInfo = costMap.get(parent.id);
      const costStr = costInfo !== undefined ? costToDisplay(costInfo.usedCost) : '';
      const exStr = [parent, ...children].map((item) => formatEntry(item, slots)).join('→');
      rows.push([msToMSS(parent.timeMs), costStr, exStr, parent.comment ?? '']);
    }
  }

  // 目標時間（撃破）行
  if (targetTimeMs !== undefined) {
    rows.push([msToMSS(targetTimeMs), '', '', '撃破']);
  }

  return rows.map((r) => r.join('\t')).join('\n');
}
