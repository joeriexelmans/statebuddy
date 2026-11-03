
export type JsonDiff = NoChange | TypeChange | ObjectChange | ArrayChange;

export type NoChange = {
  kind: 'nochange',
}

export type TypeChange = {
  kind: 'valuechange',
  before: any,
  after: any,
}

export type ObjectChange = {
  kind: 'objectchange',
  keys: KeyChange[],
}

export type KeyChange = {
  key: string,
  diff: JsonDiff,
}

export type ArrayChange = {
  kind: 'arraychange'
  before: any,
  after: any,
}



// export type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'undefined';

export function diffJSON(before: any, after: any): JsonDiff {
  if (before === after) return {kind: 'nochange'};

  if (Array.isArray(before) && Array.isArray(after)) {
    // both are array
    return diffArray(before, after);
  }

  if (typeof before === "object" && typeof after === "object") {
    if (before !== null && after !== null) {
      // both are plain object
      return diffObject(before, after);
    }
  }

  // catch all other cases
  return {kind: 'valuechange', before, after};
}

export function diffObject(before: {[key: string]: any}, after: {[key: string]: any}): JsonDiff {
  const keys = [] as KeyChange[];
  for (const keyBefore of Object.keys(before)) {
    const diff = diffJSON(before[keyBefore], after[keyBefore]);
    if (diff.kind !== 'nochange') {
      keys.push({key: keyBefore, diff});
    }
  }
  for (const keyAfter of Object.keys(after)) {
    if (Object.hasOwn(before, keyAfter)) continue; // already seen this key in previous loop
    const diff = diffJSON(before[keyAfter], after[keyAfter]);
    if (diff.kind !== 'nochange') {
      keys.push({key: keyAfter, diff});
    }
  }
  if (keys.length > 0) {
    return {kind: 'objectchange', keys};
  }
  return {kind: 'nochange'};
}

// most complex case, we try to detect insertion, deletion, and move.
export function diffArray(before: any[], after: any[]): JsonDiff {
  if (before.length === after.length) {
    for (let i=0; i<before.length; i++) {
      if (diffJSON(before[i], after[i]).kind !== 'nochange') {
        return {kind: 'arraychange', before, after};
      }
    }
    return {kind: 'nochange'};
  }
  return {kind: 'arraychange', before, after};
}

export function explainDiff(diff: JsonDiff): string[] {
  if (diff.kind === 'nochange') {
    return ['<no change>'];
  }
  else if (diff.kind === 'objectchange') {
    return diff.keys.map(({key, diff}) => key + '.' + explainDiff(diff));
  }
  else if (diff.kind === 'arraychange') {
    return ['<array changed>'];
  }
  else if (diff.kind === 'valuechange') {
    return ['<value changed>'];
  }
  throw new Error('should never reach here');
}
