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

// compare arrays by value
export function arraysEqual<T>(a: T[], b: T[], cmp: (a: T, b: T) => boolean = (a,b)=>a===b): boolean {
  if (a === b)
    return true;

  if (a.length !== b.length)
    return false;

  for (let i=0; i<a.length; i++)
    if (!cmp(a[i],b[i]))
      return false;

  return true;
}
