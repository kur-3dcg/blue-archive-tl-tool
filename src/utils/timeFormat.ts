/** ms → "M:SS.mmm" */
export function msToDisplay(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/** "M:SS.mmm" → ms */
export function displayToMs(str: string): number {
  const [minPart, rest] = str.split(':');
  const [secPart, msPart] = rest.split('.');
  return Number(minPart) * 60_000 + Number(secPart) * 1000 + Number(msPart);
}

/** コスト値 → 整数なら "X"、小数なら "X.X" 表示（0.1未満切り捨て） */
export function costToDisplay(cost: number): string {
  const floored = Math.floor(cost * 10) / 10;
  return floored % 1 === 0 ? String(floored | 0) : floored.toFixed(1);
}
