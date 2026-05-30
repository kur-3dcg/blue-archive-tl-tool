/**
 * fix-images.mjs
 * スプシの名前順に合わせた正しいimage URLのCSVを出力する
 * 出力ファイルをスプシのimage列に上書き貼り付けしてください
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

for (const { gid, jsonFile, csvFile, label } of [
  { gid: SHEET_GID_ST, jsonFile: 'data/characters_st.json', csvFile: 'data/notes/fix_images_st.csv', label: 'STRIKER' },
  { gid: SHEET_GID_SP, jsonFile: 'data/characters_sp.json', csvFile: 'data/notes/fix_images_sp.csv', label: 'SPECIAL' },
]) {
  // スプシから名前順を取得
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  const text = await res.text();
  const rows = parseCSV(text);

  // JSONから正しいimage URLをマップ化
  const existing = JSON.parse(fs.readFileSync(path.join(ROOT, jsonFile), 'utf8'));
  const imageMap = new Map(existing.filter(e => e.name !== '未選択').map(e => [e.name, e.image]));

  // スプシの名前順で正しいURLを出力
  const lines = ['名前,正しいimage'];
  let missing = 0;
  for (const row of rows) {
    const name = row['名前'];
    if (!name) continue;
    const correctUrl = imageMap.get(name) ?? '';
    if (!correctUrl) { console.warn(`  ⚠️  JSONにない: ${name}`); missing++; }
    lines.push(`${name},${correctUrl}`);
  }

  fs.writeFileSync(path.join(ROOT, csvFile), lines.join('\n') + '\n', 'utf8');
  console.log(`✅ ${label}: ${csvFile} を出力 (${lines.length - 1}件${missing ? `, ⚠️ ${missing}件URLなし` : ''})`);
}
