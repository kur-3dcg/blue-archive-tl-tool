/** ms → "M:SS.mmm" */
export function msToDisplay(ms: number): string {
  const rounded = Math.round(ms);
  const totalSeconds = Math.floor(rounded / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = rounded % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/** "M:SS.mmm" → ms */
export function displayToMs(str: string): number {
  const [minPart, rest] = str.split(':');
  const [secPart, msPart] = rest.split('.');
  return Number(minPart) * 60_000 + Number(secPart) * 1000 + Number(msPart);
}

/**
 * ユーザー入力の "M:SS" / "M:SS.mmm" → ms。形式が不正なら null。
 * 全角数字・記号（IMEオンのまま入力した場合）も半角に正規化して受け付ける。
 */
export function parseTimeInput(input: string): number | null {
  const normalized = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
    .replace(/[．。]/g, '.');
  const m = normalized.trim().match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  return (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 + parseInt((m[3] ?? '').padEnd(3, '0'));
}

/** コスト値 → 整数なら "X"、小数なら "X.X" 表示（0.1未満切り捨て） */
export function costToDisplay(cost: number): string {
  const floored = Math.floor(cost * 10) / 10;
  return floored % 1 === 0 ? String(floored | 0) : floored.toFixed(1);
}
