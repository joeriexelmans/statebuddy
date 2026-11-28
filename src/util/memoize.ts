// some custom memoization functions (independent of React/useMemo)

export function memoize<I, O>(fn: (i: I) => O) {
  const cache = new Map();
  return (i: I) => {
    const found = cache.get(i);
    if (found) {
      return found;
    }
    const result = fn(i);
    cache.set(i, result);
    return result;
  };
}

export function memoizeBounded<I, O>(fn: (i: I) => O, cacheSize = 6) {
  const cache = [] as [I, O][];
  return (i: I) => {
    const idx = cache.findIndex(([input]) => input === i);
    if (idx !== -1) {
      const [_, cachedOutput] = cache[idx];
      // move our item to back
      cache.splice(idx, 1);
      cache.push([i, cachedOutput]);
      console.log('cache hit!', i);
      return cachedOutput;
    }
    else {
      const o = fn(i);
      if (cache.length === cacheSize) {
        // make room
        cache.shift();
      }
      cache.push([i, o]);
      console.log('cache miss!', i);
      return o;
    }
  };
}
// React-like memoization that is not a React hook and therefore can be used anywhere

export function memoizeOne<InType, OutType>(fn: (i: InType) => OutType, cmp: (a: InType, b: InType) => boolean) {
  let lastIn: InType;
  let lastOut: OutType;
  return (i: InType) => {
    if (lastIn && cmp(lastIn, i)) {
      return lastOut;
    }
    const result = fn(i);
    lastIn = i;
    lastOut = result;
    return result;
  };
}
