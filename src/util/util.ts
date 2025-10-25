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

export function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a === b)
    return true;

  if (a.size !== b.size)
    return false;

  for (const itemA of a)
    if (!b.has(itemA))
      return false;

  return true;
}

export function objectsEqual<T>(a: {[key: string]: T}, b: {[key: string]: T}, cmp: (a: T, b: T) => boolean = (a,b)=>a===b): boolean {
  if (a === b)
    return true;

  if (Object.keys(a).length !== Object.keys(b).length)
    return false;

  for (const [keyA, valueA] of Object.entries(a))
    if (!cmp(b[keyA], valueA))
      return false;

  return true;
}
