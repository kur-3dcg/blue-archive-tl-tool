import type { Character, CharacterSlot, TimelineItem, StandaloneComment, SlotCostConfig, GameMode } from '../types';
import { STRIKER_COUNT, SPECIAL_COUNT, MAX_LAYERS, MAX_TOTAL_TIME_MS } from '../constants';
import stData from '../../data/characters_st.json';
import spData from '../../data/characters_sp.json';
import etcData from '../../data/etc.json';

type SlotType = 'striker' | 'special';

interface CharLookupEntry {
  char: Character;
  type: SlotType;
}

interface ParsedEntry {
  charName: string;
  targetCharName?: string;
  etcIconName?: string;
}

interface ParsedRow {
  timeMs: number;
  entries: ParsedEntry[];
  comment?: string;
}

export interface TlImportResult {
  slots: CharacterSlot[];
  items: TimelineItem[];
  standaloneComments: StandaloneComment[];
  totalTimeMs: number;
  layers: number;
  mode: GameMode;
  slotCostConfigs: SlotCostConfig[];
  warnings: string[];
  /** 検出されたキャラ一覧（表示用） */
  detectedSt: string[];
  detectedSp: string[];
}

function buildCharLookup(): Map<string, CharLookupEntry> {
  const map = new Map<string, CharLookupEntry>();

  const addChar = (char: Character, type: SlotType) => {
    const names = [char.name, char.reading, char.nameEn, char.nameKr, char.nameTw, char.nameCn]
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
    for (const name of names) {
      if (!map.has(name)) map.set(name, { char, type });
    }
  };

  for (const c of stData as Character[]) {
    if (c.name && c.name !== '未選択') addChar(c, 'striker');
  }
  for (const c of spData as Character[]) {
    if (c.name && c.name !== '未選択') addChar(c, 'special');
  }

  return map;
}

function parseMss(str: string): number | null {
  if (!str) return null;
  const match = str.match(/^(\d+):(\d{2}(?:\.\d+)?)$/);
  if (!match) return null;
  const m = parseInt(match[1], 10);
  const s = parseFloat(match[2]);
  return Math.round((m * 60 + s) * 1000);
}

/**
 * 1エントリを解析する。charLookupを使って衣装付きキャラ名と対象指定を正しく区別する。
 * 例: 「シロコ（水着）」→ charName=「シロコ（水着）」, targetCharName=undefined
 *     「ホシノ（チェリノ）」→ charName=「ホシノ」, targetCharName=「チェリノ」
 */
function parseExEntry(text: string, charLookup: Map<string, CharLookupEntry>): ParsedEntry {
  const t = text.trim();
  if (!t) return { charName: '' };

  // etcプレフィックスを先に除去
  let etcIconName: string | undefined;
  let mainPart = t;
  for (const etc of etcData as { name: string; textPrefix?: string }[]) {
    if (etc.textPrefix && t.startsWith(etc.textPrefix)) {
      const stripped = t.slice(etc.textPrefix.length);
      if (stripped.length > 0) {
        etcIconName = etc.name;
        mainPart = stripped;
        break;
      }
    }
  }

  // 全体がキャラ名として存在するか確認（衣装付き等を優先）
  if (charLookup.has(mainPart)) {
    return { charName: mainPart, etcIconName };
  }

  // 貪欲マッチで最後の（...）をターゲット候補として取得
  // 例: 「ホシノ（チェリノ）」→ charPart=「ホシノ」, candidate=「チェリノ」
  //     「シロコ（水着）（ホシノ）」→ charPart=「シロコ（水着）」, candidate=「ホシノ」
  const targetMatch = mainPart.match(/^(.+)（(.+)）$/);
  if (targetMatch) {
    const charPart = targetMatch[1];
    const candidate = targetMatch[2];
    // charPartが有効なキャラ名の場合のみターゲットとして扱う
    if (charLookup.has(charPart)) {
      return { charName: charPart, targetCharName: candidate, etcIconName };
    }
  }

  // いずれにもHitしない場合は全体をキャラ名として扱う
  return { charName: mainPart, etcIconName };
}

function parseRows(
  text: string,
  charLookup: Map<string, CharLookupEntry>
): { rows: ParsedRow[]; parseWarnings: string[] } {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  const parseWarnings: string[] = [];

  // カラムフォーマット検出（旧: 時間/コスト/EX/コメント → 新: 時間/EX/コメント）
  let exCol = 1;
  let commentCol = 2;
  for (const line of lines) {
    const firstCols = line.split('\t');
    const first = firstCols[0]?.trim();
    if (first === '時間' || first === 'Time' || first === '시간' || first === '时间') {
      const second = firstCols[1]?.trim();
      if (second === 'コスト' || second === 'Cost') {
        exCol = 2;
        commentCol = 3;
      }
      break;
    }
  }

  for (const line of lines) {
    const cols = line.split('\t');
    const timeStr = cols[0]?.trim() ?? '';
    const exStr = cols[exCol]?.trim() ?? '';
    const commentStr = cols[commentCol]?.trim() ?? '';

    // ヘッダー行スキップ
    if (timeStr === '時間' || timeStr === 'Time' || timeStr === '시간' || timeStr === '时间' || timeStr === '時間') continue;

    const timeMs = parseMss(timeStr);
    if (timeMs === null) {
      if (timeStr) parseWarnings.push(`時間パースエラー: "${timeStr}" をスキップ`);
      continue;
    }

    const entries: ParsedEntry[] = [];
    if (exStr) {
      for (const part of exStr.split('→')) {
        const trimmed = part.trim();
        if (trimmed) {
          const entry = parseExEntry(trimmed, charLookup);
          if (entry.charName) entries.push(entry);
        }
      }
    }

    if (entries.length === 0 && !commentStr) continue;

    rows.push({ timeMs, entries, comment: commentStr || undefined });
  }

  return { rows, parseWarnings };
}

export function parseTlText(text: string): TlImportResult {
  const warnings: string[] = [];
  const charLookup = buildCharLookup();
  const { rows, parseWarnings } = parseRows(text, charLookup);
  warnings.push(...parseWarnings);

  // テキストに登場するキャラ名を初登場順に収集
  const charOrder: string[] = [];
  const charOrderSet = new Set<string>();

  const addToOrder = (name: string) => {
    if (name && !charOrderSet.has(name)) {
      charOrderSet.add(name);
      charOrder.push(name);
    }
  };

  // メインキャラを先に、対象キャラを後に追加
  for (const row of rows) {
    for (const entry of row.entries) {
      addToOrder(entry.charName);
    }
  }
  for (const row of rows) {
    for (const entry of row.entries) {
      if (entry.targetCharName) addToOrder(entry.targetCharName);
    }
  }

  // キャラをST/SPに分類
  const strikerChars: Array<{ name: string; char: Character }> = [];
  const specialChars: Array<{ name: string; char: Character }> = [];
  const notFoundNames = new Set<string>();

  for (const name of charOrder) {
    const entry = charLookup.get(name);
    if (!entry) {
      notFoundNames.add(name);
      continue;
    }
    const canonicalName = entry.char.name;
    if (entry.type === 'striker') {
      if (!strikerChars.some((c) => c.name === canonicalName)) {
        strikerChars.push({ name: canonicalName, char: entry.char });
      }
    } else {
      if (!specialChars.some((c) => c.name === canonicalName)) {
        specialChars.push({ name: canonicalName, char: entry.char });
      }
    }
  }

  if (notFoundNames.size > 0) {
    warnings.push(`未認識キャラ: ${[...notFoundNames].join(', ')} (スキップ)`);
  }

  const mode: GameMode = 'normal';
  const maxSt = STRIKER_COUNT; // 4
  const maxSp = SPECIAL_COUNT; // 2

  if (strikerChars.length > maxSt) {
    warnings.push(`STキャラが${strikerChars.length}人（上限${maxSt}人）。最初の${maxSt}人のみ使用`);
  }
  if (specialChars.length > maxSp) {
    warnings.push(`SPキャラが${specialChars.length}人（上限${maxSp}人）。最初の${maxSp}人のみ使用`);
  }

  const usedSt = strikerChars.slice(0, maxSt);
  const usedSp = specialChars.slice(0, maxSp);

  // 名前 → slotIndex マップ（正規名で登録）
  const nameToSlot = new Map<string, number>();
  usedSt.forEach((c, i) => nameToSlot.set(c.name, i));
  usedSp.forEach((c, i) => nameToSlot.set(c.name, maxSt + i));

  // テキスト中の名前（別言語等）も同スロットに対応付け
  for (const originalName of charOrder) {
    if (nameToSlot.has(originalName)) continue;
    const entry = charLookup.get(originalName);
    if (!entry) continue;
    const slotIdx = nameToSlot.get(entry.char.name);
    if (slotIdx !== undefined) {
      nameToSlot.set(originalName, slotIdx);
    }
  }

  // CharacterSlot 配列構築（通常モード: 6スロット）
  const slots: CharacterSlot[] = [];
  for (let i = 0; i < maxSt; i++) {
    slots.push({ type: 'striker', index: i, character: i < usedSt.length ? usedSt[i].char : null });
  }
  for (let i = 0; i < maxSp; i++) {
    slots.push({ type: 'special', index: i, character: i < usedSp.length ? usedSp[i].char : null });
  }

  // slotCostConfigs（キャラデータのコストを初期値に）
  const slotCostConfigs: SlotCostConfig[] = slots.map((slot) => ({
    skillCost: slot.character?.cost ?? 3,
    hasUniqueWeapon4: false,
    hasUniqueWeapon2: true,
  }));

  // アイテムとスタンドアロンコメントを構築
  const items: TimelineItem[] = [];
  const standaloneComments: StandaloneComment[] = [];
  let maxChainLength = 0;
  const now = Date.now();

  // エントリをフラット化（コメントは各行の先頭エントリに付与）
  interface EntryMeta {
    timeMs: number;
    entry: ParsedEntry;
    comment?: string;
  }
  const allEntries: EntryMeta[] = [];

  for (const row of rows) {
    if (row.entries.length === 0) {
      if (row.comment) {
        standaloneComments.push({
          id: `imported-sc-${now}-${standaloneComments.length}`,
          timeMs: row.timeMs,
          text: row.comment,
        });
      }
      continue;
    }

    const validEntries = row.entries.filter((e) => nameToSlot.has(e.charName));
    if (validEntries.length === 0) continue;

    validEntries.forEach((entry, idx) => {
      allEntries.push({
        timeMs: row.timeMs,
        entry,
        comment: idx === 0 ? row.comment : undefined,
      });
    });
  }

  // 時間降順ソート（降順処理で lastTimeOnLayer[l] が常にそのレイヤーの最小値になる）
  allEntries.sort((a, b) => b.timeMs - a.timeMs);

  // 3.3秒以上離れていれば同一レイヤーに配置できる
  const OVERLAP_THRESHOLD_MS = 3300;
  // lastTimeOnLayer[l] = レイヤー l に最後に配置したアイテムの timeMs（降順処理なので最小値）
  const lastTimeOnLayer: number[] = [];

  for (const meta of allEntries) {
    // 空きレイヤーを貪欲に探す（距離 > 3300ms なら配置可）
    let assignedLayer = -1;
    for (let l = 0; l < MAX_LAYERS; l++) {
      if (lastTimeOnLayer[l] === undefined || lastTimeOnLayer[l] - meta.timeMs > OVERLAP_THRESHOLD_MS) {
        assignedLayer = l;
        break;
      }
    }
    // 全レイヤーが埋まっている場合は最後のレイヤーに重ねる
    if (assignedLayer === -1) assignedLayer = MAX_LAYERS - 1;

    lastTimeOnLayer[assignedLayer] = meta.timeMs;
    maxChainLength = Math.max(maxChainLength, assignedLayer + 1);

    const slotIndex = nameToSlot.get(meta.entry.charName)!;
    const targetSlotIndex =
      meta.entry.targetCharName !== undefined ? nameToSlot.get(meta.entry.targetCharName) : undefined;

    const item: TimelineItem = {
      id: `imported-${now}-${items.length}`,
      slotIndex,
      timeMs: meta.timeMs,
      layerIndex: assignedLayer,
    };

    if (targetSlotIndex !== undefined) item.targetSlotIndex = targetSlotIndex;
    if (meta.entry.etcIconName) item.targetEtcIcon = meta.entry.etcIconName;
    if (meta.comment) item.comment = meta.comment;

    items.push(item);
  }

  // 最大時間からtotalTimeMsを決定（プリセットに切り上げ）
  const maxTimeMs = rows.length > 0 ? Math.max(...rows.map((r) => r.timeMs)) : 240_000;
  const presetMs = [180_000, 240_000, 270_000, MAX_TOTAL_TIME_MS];
  const totalTimeMs = presetMs.find((p) => p >= maxTimeMs) ?? MAX_TOTAL_TIME_MS;

  // 必要レイヤー数
  const layers = Math.max(1, Math.min(maxChainLength, MAX_LAYERS));

  return {
    slots,
    items,
    standaloneComments,
    totalTimeMs,
    layers,
    mode,
    slotCostConfigs,
    warnings,
    detectedSt: usedSt.map((c) => c.name),
    detectedSp: usedSp.map((c) => c.name),
  };
}
