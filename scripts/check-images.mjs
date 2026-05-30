/**
 * check-images.mjs
 * スプシとJSONのimage URLの整合性チェック
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim(); });
    return obj;
  });
}

const env = loadEnv();
const { SHEET_ID, SHEET_GID_ST, SHEET_GID_SP } = env;

for (const { gid, jsonFile, label } of [
  { gid: SHEET_GID_ST, jsonFile: 'data/characters_st.json', label: 'STRIKER' },
  { gid: SHEET_GID_SP, jsonFile: 'data/characters_sp.json', label: 'SPECIAL' },
]) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  const text = await res.text();
  const rows = parseCSV(text);

  const existing = JSON.parse(fs.readFileSync(path.join(ROOT, jsonFile), 'utf8'));
  const jsonMap = new Map(existing.filter(e => e.name !== '未選択').map(e => [e.name, e.image]));
  const sheetNames = new Set(rows.map(r => r['名前']));

  console.log(`\n=== ${label} (スプシ${rows.length}件 / JSON${jsonMap.size}件) ===`);

  const hasImage = rows[0] && 'image' in rows[0];
  console.log(`image列: ${hasImage ? 'あり' : 'なし'}`);

  let ok = true;

  for (const row of rows) {
    const name = row['名前'];
    if (!name) continue;
    const sheetImg = (row['image'] ?? '').trim();
    const jsonImg = jsonMap.get(name);

    if (jsonImg === undefined) {
      console.log(`  🆕 新キャラ(JSONにない): ${name}`);
      ok = false;
    } else if (!sheetImg) {
      console.log(`  ⚠️  image未設定(スプシ): ${name}`);
      ok = false;
    } else if (sheetImg !== jsonImg) {
      console.log(`  ❌ 不一致: ${name}`);
      console.log(`     スプシ: ${sheetImg}`);
      console.log(`     JSON:  ${jsonImg}`);
      ok = false;
    }
  }

  // JSONにあってスプシにない
  for (const [name] of jsonMap) {
    if (!sheetNames.has(name)) {
      console.log(`  📋 JSONにあってスプシにない: ${name}`);
      ok = false;
    }
  }

  if (ok) console.log(`  ✅ すべて一致`);
}
