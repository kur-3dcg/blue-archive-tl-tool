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

/** コスト値 → "X.X" or "XX.X" 表示（0.1未満切り捨て） */
export function costToDisplay(cost: number): string {
  return (Math.floor(cost * 10) / 10).toFixed(1);
}
