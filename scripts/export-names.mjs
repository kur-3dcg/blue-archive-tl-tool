/**
 * 多言語データから各キャラの名前を抽出してCSV出力
 * 出力: data/notes/names_multilang.csv
 * 列: 日本語名, English, 한국어, 中文(繁), 中文(简), タイプ, 状態
 *   状態: 確認済み（データセット一致）| 予測（パターンから生成）| 未確認（ベース名不明）
 *
 * 使い方: node scripts/export-names.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf-8'));
}

const jp = loadJson('多言語データ/jp/students.json');
const en = loadJson('多言語データ/en/students.json');
const kr = loadJson('多言語データ/kr/students.json');
const tw = loadJson('多言語データ/tw/students.json');
const cn = loadJson('多言語データ/cn/students.json');

// Id → 各言語名 のマップ
const byId = new Map();
for (const s of jp) byId.set(s.Id, { ja: s.Name });
for (const s of en) if (byId.has(s.Id)) byId.get(s.Id).en = s.Name;
for (const s of kr) if (byId.has(s.Id)) byId.get(s.Id).kr = s.Name;
for (const s of tw) if (byId.has(s.Id)) byId.get(s.Id).tw = s.Name;
for (const s of cn) if (byId.has(s.Id)) byId.get(s.Id).cn = s.Name;

// 日本語名 → 各言語名 の逆引きマップ（確認済みのみ）
const jaToNames = new Map();
for (const [, d] of byId) {
  if (d.ja && d.en) jaToNames.set(d.ja, d);
}

// サフィックス対応表（データセットから抽出 + 推定分を追加）
// ※「予測」と「確認済み」を区別するため、確認済みサフィックスをセットで管理
const CONFIRMED_SUFFIXES = new Set([
  '水着','ドレス','正月','バンド','制服','臨戦','私服','ガイド',
  'キャンプ','バニーガール','メイド','応援団','クリスマス','体操服',
  '幼女','ライディング','温泉',
]);

const SUFFIX_EN = {
  '水着':    'Swimsuit',
  'ドレス':  'Dress',
  '正月':    'New Year',
  'バンド':  'Band',
  '制服':    'School Uniform',
  '臨戦':    'Battle',
  '私服':    'Casual',
  'ガイド':  'Guide',
  'キャンプ':'Camp',
  'バニーガール':'Bunny',
  'メイド':  'Maid',
  '応援団':  'Cheer Squad',
  'クリスマス':'Christmas',
  '体操服':  'Track',
  '幼女':    'Small',
  'ライディング':'Cycling',
  '温泉':    'Hot Spring',
  // 以下は推定（グローバル版未確認）
  'アイドル':'Idol',
  'パジャマ':'Pajama',
  'アルバイト':'Part-Time',
  'マジカル':'Magical',
  'チーパオ':'Cheongsam',
  '攻撃':    'Battle (Dealer)',
  '防御':    'Battle (Tank)',
};

const SUFFIX_KR = {
  '水着':'수영복','ドレス':'드레스','正月':'새해','バンド':'밴드',
  '制服':'교복','臨戦':'전투','私服':'사복','ガイド':'가이드',
  'キャンプ':'캠핑','バニーガール':'바니걸','メイド':'메이드','応援団':'응원단',
  'クリスマス':'크리스마스','アイドル':'아이돌','パジャマ':'파자마',
  'アルバイト':'아르바이트','マジカル':'매지컬','チーパオ':'치파오',
  '攻撃':'전투(딜)','防御':'전투(탱)',
};

const SUFFIX_TW = {
  '水着':'(泳裝)','ドレス':'(禮服)','正月':'(正月)','バンド':'（樂隊）',
  '制服':'(制服)','臨戦':'(臨戰)','私服':'(便服)','ガイド':'(嚮導)',
  'キャンプ':'(露營)','バニーガール':'(兔女郎)','メイド':'(女僕)','応援団':'(應援團)',
  'クリスマス':'(聖誕節)','アイドル':'(偶像)','パジャマ':'(睡衣)',
  'アルバイト':'(打工)','マジカル':'(魔法)','チーパオ':'(旗袍)',
};

const SUFFIX_CN = {
  '水着':'（泳装）','ドレス':'（礼服）','正月':'（正月）','バンド':'（乐队）',
  '制服':'（制服）','臨戦':'（临战）','私服':'（便服）','ガイド':'（向导）',
  'キャンプ':'（露营）','バニーガール':'（邦妮）','メイド':'（女仆）','応援団':'(应援团)',
  'クリスマス':'（圣诞）','アイドル':'（偶像）','パジャマ':'（睡衣）',
  'アルバイト':'（打工）','マジカル':'（魔法）','チーパオ':'（旗袍）',
};

function parseName(name) {
  const m = name.match(/^(.+?)（(.+?)）$/);
  return m ? { base: m[1], suffix: m[2] } : { base: name, suffix: null };
}

function predict(jaName) {
  const { base, suffix } = parseName(jaName);
  const baseNames = jaToNames.get(base);
  if (!baseNames) return null;

  if (!suffix) return null; // ベース名自体はunmatchedなら予測不可

  const enSuffix = SUFFIX_EN[suffix];
  if (!enSuffix) return null;

  const isConfirmed = CONFIRMED_SUFFIXES.has(suffix);

  // KR/TW/CN: ベース名にサフィックスを付ける
  const krBase = baseNames.kr ?? base;
  const twBase = baseNames.tw ?? base;
  const cnBase = baseNames.cn ?? base;

  return {
    en: `${baseNames.en} (${enSuffix})`,
    kr: SUFFIX_KR[suffix] ? `${krBase}(${SUFFIX_KR[suffix]})` : '',
    tw: SUFFIX_TW[suffix] ? `${twBase}${SUFFIX_TW[suffix]}` : '',
    cn: SUFFIX_CN[suffix] ? `${cnBase}${SUFFIX_CN[suffix]}` : '',
    status: isConfirmed ? '予測(確認済みSuffix)' : '予測(要確認)',
  };
}

const stChars = loadJson('data/characters_st.json');
const spChars = loadJson('data/characters_sp.json');

const rows = [['日本語名', 'English', '한국어', '中文(繁)', '中文(简)', 'タイプ', '状態']];

function processChars(chars, type) {
  for (const c of chars) {
    if (!c.name || c.name === '未選択') continue;

    // 1. 完全一致（確認済み）
    const confirmed = jaToNames.get(c.name);
    if (confirmed) {
      rows.push([c.name, confirmed.en ?? '', confirmed.kr ?? '', confirmed.tw ?? '', confirmed.cn ?? '', type, '確認済み']);
      continue;
    }

    // 2. パターン予測（衣装違い）
    const predicted = predict(c.name);
    if (predicted) {
      rows.push([c.name, predicted.en, predicted.kr, predicted.tw, predicted.cn, type, predicted.status]);
      continue;
    }

    // 3. 未確認
    rows.push([c.name, '', '', '', '', type, '未確認']);
  }
}

processChars(stChars, 'ST');
processChars(spChars, 'SP');

function escapeCsv(val) {
  const s = String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\n');
const outPath = resolve(root, 'data/notes/names_multilang.csv');
writeFileSync(outPath, '\uFEFF' + csv, 'utf-8');

const confirmed = rows.slice(1).filter(r => r[6] === '確認済み').length;
const predicted = rows.slice(1).filter(r => r[6].startsWith('予測')).length;
const unknown = rows.slice(1).filter(r => r[6] === '未確認').length;

console.log(`出力: ${outPath}`);
console.log(`合計: ${rows.length - 1} キャラ`);
console.log(`  確認済み: ${confirmed}`);
console.log(`  予測:     ${predicted}`);
console.log(`  未確認:   ${unknown}`);
