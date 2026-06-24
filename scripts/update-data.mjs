/**
 * update-data.mjs
 * スプレッドシートからキャラデータJSONを更新するスクリプト
 * 使い方: node scripts/update-data.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- .env 読み込み ----
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env ファイルが見つかりません。.env.example を参考に .env を作成してください。');
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

// ---- CSV パース（シンプル実装） ----
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  const headers = splitCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const values = splitCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim(); });
      return obj;
    });
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ---- CSV行 → JSONオブジェクト変換 ----
function rowToEntry(row, existingImage) {
  const cost = parseInt(row['コスト'], 10);
  const exRaw = row['EX時間（秒）'];
  const exDuration = exRaw !== '' && !isNaN(parseFloat(exRaw)) ? parseFloat(exRaw) : null;
  const exDelayRaw = row['EXディレイ時間'];
  const exDelayVal = exDelayRaw !== '' && !isNaN(parseFloat(exDelayRaw)) ? parseFloat(exDelayRaw) : 0;
  const exDelay = exDelayVal > 0 ? exDelayVal : undefined;
  // スプシのimage列を優先、なければ既存JSONのURLを引き継ぎ
  const image = (row['image'] ?? '').trim() || existingImage || '';
  const hasDurationBuff = row['バフ時間増加'] === 'TRUE' || row['バフ時間増加'] === 'true' || row['バフ時間増加'] === '1' ? true : undefined;
  const nameEn = (row['English'] ?? '').trim() || undefined;
  const nameKr = (row['한국어'] ?? '').trim() || undefined;
  const nameTw = (row['中文(繁)'] ?? '').trim() || undefined;
  const nameCn = (row['中文(简)'] ?? '').trim() || undefined;
  return {
    name: row['名前'],
    image,
    reading: row['よみ'],
    school: row['学校'],
    attackType: row['攻撃'],
    armorType: row['防御'],
    cost: isNaN(cost) ? 3 : cost,
    exDuration,
    ...(exDelay !== undefined && { exDelay }),
    ...(hasDurationBuff && { hasDurationBuff }),
    ...(nameEn && { nameEn }),
    ...(nameKr && { nameKr }),
    ...(nameTw && { nameTw }),
    ...(nameCn && { nameCn }),
  };
}

// ---- CSV フェッチ ----
async function fetchCSV(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// ---- メイン ----
async function main() {
  const env = loadEnv();
  const { SHEET_ID, SHEET_GID_ST, SHEET_GID_SP } = env;

  if (!SHEET_ID || !SHEET_GID_ST || !SHEET_GID_SP) {
    console.error('❌ .env に SHEET_ID / SHEET_GID_ST / SHEET_GID_SP が必要です。');
    process.exit(1);
  }

  for (const { gid, jsonFile, label } of [
    { gid: SHEET_GID_ST, jsonFile: 'data/characters_st.json', label: 'STRIKER' },
    { gid: SHEET_GID_SP, jsonFile: 'data/characters_sp.json', label: 'SPECIAL' },
  ]) {
    console.log(`\n📥 ${label} シートを取得中...`);
    const csv = await fetchCSV(SHEET_ID, gid);
    const rows = parseCSV(csv);

    // 既存JSONを名前でインデックス化（image URL保持用）
    const jsonPath = path.join(ROOT, jsonFile);
    const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const imageMap = new Map(existing.map(e => [e.name, e.image]));

    // "未選択" エントリを先頭に保持
    const placeholder = existing.find(e => e.name === '未選択');

    const newEntries = rows
      .filter(row => row['名前'] && row['名前'] !== '未選択')
      .map(row => {
        const entry = rowToEntry(row, imageMap.get(row['名前']));
        if (!entry.image) {
          console.warn(`  ⚠️  image未設定: ${entry.name}`);
        }
        return entry;
      });

    // 名前でソート（アイウエオ順）
    newEntries.sort((a, b) => a.reading.localeCompare(b.reading, 'ja'));

    const output = placeholder ? [placeholder, ...newEntries] : newEntries;

    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`  ✅ ${jsonFile} を更新しました（${newEntries.length} 件）`);
  }

  console.log('\n🎉 完了！');
}

main().catch(e => { console.error('❌ エラー:', e.message); process.exit(1); });
