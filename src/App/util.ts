export function formatTime(timeMs: number) {
  const leadingZeros = "00" + Math.floor(timeMs) % 1000;
  const formatted = `${Math.floor(timeMs / 1000)}.${(leadingZeros).substring(leadingZeros.length-3)}`;
  return formatted;
}

export function compactTime(timeMs: number) {
  if (timeMs % 1000 === 0) {
    return `${timeMs / 1000}s`;
  } 
  return `${timeMs} ms`;
}

export function memoize<InType,OutType>(fn: (i: InType) => OutType) {
  const cache = new Map();
  return (i: InType) => {
    const found = cache.get(i);
    if (found) {
      return found;
    }
    const result = fn(i);
    cache.set(i, result);
    return result;
  }
}
