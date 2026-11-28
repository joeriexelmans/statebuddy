
// compare arrays by value
export function arraysEqual<T>(a: T[], b: T[], cmp: (a: T, b: T) => boolean = (a, b) => a === b): boolean {
  if (a === b)
    return true;

  if (a.length !== b.length)
    return false;

  for (let i = 0; i < a.length; i++)
    if (!cmp(a[i], b[i]))
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

export function objectsEqual<T>(a: { [key: string]: T; }, b: { [key: string]: T; }, cmp: (a: T, b: T) => boolean = (a, b) => a === b): boolean {
  if (a === b)
    return true;

  if (Object.keys(a).length !== Object.keys(b).length)
    return false;

  for (const [keyA, valueA] of Object.entries(a))
    if (!cmp(b[keyA], valueA))
      return false;

  return true;
}

export function mapsEqual<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>, cmp: (a: V, b: V) => boolean = (a, b) => a === b) {
  if (a === b)
    return true;

  if (a.size !== b.size)
    return false;

  for (const [keyA, valA] of a.entries()) {
    const valB = b.get(keyA);
    if (valB === undefined)
      return false;
    if (!cmp(valA, valB))
      return false;
  }

  return true;
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

