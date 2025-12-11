export function formatTime(timeMs: number) {
  if (timeMs === Infinity) {
    return '+inf';
  }
  const leadingZeros = "00" + Math.floor(timeMs) % 1000;
  const formatted = `${Math.floor(timeMs / 1000)}.${(leadingZeros).substring(leadingZeros.length-3)}`;
  return formatted;
}

const leadingZeros = (n: number) => ('0'+n).slice(-2);

export function formatDateTime(now: Date) {
  return `${now.getFullYear()}/${leadingZeros(now.getMonth()+1)}/${leadingZeros(now.getDate())} ${leadingZeros(now.getHours())}:${leadingZeros(now.getMinutes())}`;
}

export function* range(n: number) {
  for (let i=0; i<n; i++) yield n;
}

export function count<T>(arr: Array<T>, predicate: (x: T) => boolean) {
  let count=0;
  for (let i=0; i<arr.length; i++) {
    if (predicate(arr[i])) {
      count++;
    }
  }
  return count;
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

// React-like memoization that is not a React hook and therefore can be used anywhere
export function memoizeOne<InType,OutType>(fn: (i: InType) => OutType, cmp: (a: InType, b: InType) => boolean) {
  let lastIn: InType;
  let lastOut: OutType;
  return (i: InType) => {
    if (lastIn && cmp(lastIn,i)) {
      return lastOut;
    }
    const result = fn(i);
    lastIn = i;
    lastOut = result;
    return result;
  }
}

// author: ChatGPT
export function jsonDeepEqual(a: any, b: any) {
  if (a === b) return true;
  if (a && b && typeof a === "object" && typeof b === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!jsonDeepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
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

export function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
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

export function mapsEqual<K,V>(a: ReadonlyMap<K,V>, b: ReadonlyMap<K,V>, cmp: (a: V, b: V) => boolean = (a,b)=>a===b) {
  if (a===b)
    return true;

  if (a.size !== b.size)
    return false;

  for (const [keyA,valA] of a.entries()) {
    const valB = b.get(keyA);
    if (valB === undefined)
      return false;
    if (!cmp(valA, valB))
      return false;
  }

  return true;
}


export function withGrow<T>(arr: T[], i: number, value: T, fill: T) {
  if (i >= arr.length) {
    arr = [...arr, ...new Array(i - arr.length + 1).map(_ => fill)];
  }
  return arr.with(i, value);
}
