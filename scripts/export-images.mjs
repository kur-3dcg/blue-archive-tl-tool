/**
 * export-images.mjs
 * 既存JSONからimage URLをCSV出力するスクリプト（スプシへの貼り付け用）
 * 使い方: node scripts/export-images.mjs
 * 出力: data/notes/images_st.csv, data/notes/images_sp.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

for (const { jsonFile, csvFile, label } of [
  { jsonFile: 'data/characters_st.json', csvFile: 'data/notes/images_st.csv', label: 'STRIKER' },
  { jsonFile: 'data/characters_sp.json', csvFile: 'data/notes/images_sp.csv', label: 'SPECIAL' },
]) {
  const entries = JSON.parse(fs.readFileSync(path.join(ROOT, jsonFile), 'utf8'));
  const lines = ['名前,image'];
  for (const e of entries) {
    if (e.name === '未選択') continue;
    lines.push(`${e.name},${e.image}`);
  }
  fs.writeFileSync(path.join(ROOT, csvFile), lines.join('\n') + '\n', 'utf8');
  console.log(`✅ ${csvFile} を出力しました（${lines.length - 1} 件）`);
}
