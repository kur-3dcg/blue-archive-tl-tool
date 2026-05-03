import type { CharacterSlot, TimelineItem, TimelineArrow, SlotCostConfig } from '../types';
import stCharacters from '../../data/characters_st.json';
import spCharacters from '../../data/characters_sp.json';

// --- Name → Image lookup ---
const nameToImage = new Map<string, string>();
for (const c of stCharacters) nameToImage.set(c.name, c.image);
for (const c of spCharacters) nameToImage.set(c.name, c.image);

export function resolveImage(name: string): string {
  return nameToImage.get(name) ?? '';
}

// --- Legacy format (for backward-compatible import) ---
interface ShareDataLegacy {
  slots: { name: string; image: string; type: string; index: number }[];
  items: { slotIndex: number; timeMs: number; layerIndex: number; comment?: string; costAdjustment?: number; targetSlotIndex?: number; useTimeDisplay?: boolean }[];
  arrows?: { fromIndex: number; toIndex: number }[];
  layers: number;
  totalTimeMs?: number;
  slotCostConfigs?: { skillCost: number; hasUniqueWeapon4: boolean }[];
}

// --- Compact format (short keys, no image URLs) ---
interface CompactData {
  s: { n: string; t: string; i: number }[];              // slots: name, type, index
  m: { s: number; t: number; l: number; c?: string; a?: number; g?: number; d?: boolean }[]; // items
  r?: { f: number; o: number }[];                         // arrows: from, to
  l: number;                                               // layers
  T?: number;                                              // totalTimeMs
  C?: { k: number; u: boolean }[];                        // slotCostConfigs: skillCost, uniqueWeapon4
  G?: number;                                              // targetTimeMs
  H?: number;                                              // heavyArmorCount
  W?: number;                                              // redWinterCount
}

// Decoded result (unified)
export interface ShareData {
  slots: { name: string; image: string; type: string; index: number }[];
  items: { slotIndex: number; timeMs: number; layerIndex: number; comment?: string; costAdjustment?: number; targetSlotIndex?: number; useTimeDisplay?: boolean }[];
  arrows?: { fromIndex: number; toIndex: number }[];
  layers: number;
  totalTimeMs?: number;
  slotCostConfigs?: { skillCost: number; hasUniqueWeapon4: boolean }[];
  targetTimeMs?: number;
  heavyArmorCount?: number;
  redWinterCount?: number;
}

// --- Compression helpers using DecompressionStream/CompressionStream ---

async function compressBytes(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

async function decompressBytes(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

// Base64 <-> Uint8Array
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Encode (async, returns compact compressed code with "Z:" prefix) ---

export async function encode(
  slots: CharacterSlot[],
  items: TimelineItem[],
  layers: number,
  totalTimeMs: number,
  arrows: TimelineArrow[] = [],
  slotCostConfigs?: SlotCostConfig[],
  targetTimeMs?: number,
  heavyArmorCount?: number,
  redWinterCount?: number
): Promise<string> {
  const itemIdToIndex = new Map(items.map((item, idx) => [item.id, idx]));

  const compact: CompactData = {
    s: slots
      .filter((s) => s.character)
      .map((s) => ({
        n: s.character!.name,
        t: s.type === 'striker' ? 'S' : 'P',
        i: s.index,
      })),
    m: items.map((i) => ({
      s: i.slotIndex,
      t: i.timeMs,
      l: i.layerIndex,
      ...(i.comment ? { c: i.comment } : {}),
      ...(i.costAdjustment ? { a: i.costAdjustment } : {}),
      ...(i.targetSlotIndex !== undefined ? { g: i.targetSlotIndex } : {}),
      ...(i.useTimeDisplay ? { d: true } : {}),
    })),
    ...(arrows.length > 0
      ? {
          r: arrows
            .filter((a) => itemIdToIndex.has(a.fromItemId) && itemIdToIndex.has(a.toItemId))
            .map((a) => ({
              f: itemIdToIndex.get(a.fromItemId)!,
              o: itemIdToIndex.get(a.toItemId)!,
            })),
        }
      : {}),
    l: layers,
    T: totalTimeMs,
    ...(slotCostConfigs ? { C: slotCostConfigs.map((c) => ({ k: c.skillCost, u: c.hasUniqueWeapon4 })) } : {}),
    ...(targetTimeMs !== undefined ? { G: targetTimeMs } : {}),
    ...(heavyArmorCount ? { H: heavyArmorCount } : {}),
    ...(redWinterCount ? { W: redWinterCount } : {}),
  };

  const jsonStr = JSON.stringify(compact);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const compressed = await compressBytes(jsonBytes);
  return 'Z:' + uint8ToBase64(compressed);
}

// --- Decode (async, supports both new "Z:" format and legacy plain base64) ---

export async function decode(code: string): Promise<ShareData | null> {
  try {
    const trimmed = code.trim();

    if (trimmed.startsWith('Z:')) {
      // New compressed compact format
      const b64 = trimmed.slice(2);
      const compressed = base64ToUint8(b64);
      const jsonBytes = await decompressBytes(compressed);
      const jsonStr = new TextDecoder().decode(jsonBytes);
      const compact = JSON.parse(jsonStr) as CompactData;
      return compactToShareData(compact);
    }

    // Legacy uncompressed format
    const json = decodeURIComponent(escape(atob(trimmed)));
    const legacy = JSON.parse(json) as ShareDataLegacy;
    return legacy;
  } catch {
    return null;
  }
}

function compactToShareData(c: CompactData): ShareData {
  return {
    slots: c.s.map((s) => ({
      name: s.n,
      image: resolveImage(s.n),
      type: s.t === 'S' ? 'striker' : 'special',
      index: s.i,
    })),
    items: c.m.map((m) => ({
      slotIndex: m.s,
      timeMs: m.t,
      layerIndex: m.l,
      ...(m.c ? { comment: m.c } : {}),
      ...(m.a ? { costAdjustment: m.a } : {}),
      ...(m.g !== undefined ? { targetSlotIndex: m.g } : {}),
      ...(m.d ? { useTimeDisplay: true } : {}),
    })),
    ...(c.r ? { arrows: c.r.map((a) => ({ fromIndex: a.f, toIndex: a.o })) } : {}),
    layers: c.l,
    totalTimeMs: c.T,
    slotCostConfigs: c.C?.map((cc) => ({ skillCost: cc.k, hasUniqueWeapon4: cc.u })),
    targetTimeMs: c.G,
    heavyArmorCount: c.H,
    redWinterCount: c.W,
  };
}
