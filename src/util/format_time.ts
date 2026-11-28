
export function formatTime(timeMs: number) {
  if (timeMs === Infinity) {
    return '+inf';
  }
  const leadingZeros = "00" + Math.floor(timeMs) % 1000;
  const formatted = `${Math.floor(timeMs / 1000)}.${(leadingZeros).substring(leadingZeros.length - 3)}`;
  return formatted;
}
const leadingZeros = (n: number) => ('0' + n).slice(-2);

export function formatDateTime(now: Date) {
  return `${now.getFullYear()}/${leadingZeros(now.getMonth() + 1)}/${leadingZeros(now.getDate())} ${leadingZeros(now.getHours())}:${leadingZeros(now.getMinutes())}`;
}

export function compactTime(timeMs: number) {
  if (timeMs % 1000 === 0) {
    return `${timeMs / 1000}s`;
  }
  return `${timeMs} ms`;
}
