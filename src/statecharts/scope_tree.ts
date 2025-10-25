export type ScopeTree = {
  env: ReadonlyMap<string, any>;
  children: { [key: string]: ScopeTree };
}

// create or update an entry somewhere in the scope tree
export function writeST(key: string, val: any, path: string[], {env, children}: ScopeTree): ScopeTree {
  if (path.length === 0) {
    return {
      env: new Map([...env, [key, val]]),
      children,
    };
  }
  else {
    const [childId, ...rest] = path;
    return {
      env,
      children: {
        ...children,
        [childId]: writeST(key, val, rest, children[childId] || {env: new Map(), children: {}}),
      },
    };
  }
}

export function getST(path: string[], key: string, {env, children}: ScopeTree): any | undefined {
  if (path.length === 0) {
    if (env.has(key)) {
      return env.get(key);
    }
    return; // not found
  }
  else {
    // follow path
    const [childId, ...rest] = path;
    let found;
    if (Object.hasOwn(children, childId)) {
      found = getST(rest, key, children[childId]);
    }
    if (found === undefined) {
      // lookup in parent (yes that's us)
      return getST([], key, {env, children});
    }
    else {
      return found;
    }
  }
}

// only overwrites variable if it exists somewhere along the path, preferring deep over shallow
// otherwise, returns undefined.
export function updateST(path: string[], key: string, val: any, {env, children}: ScopeTree): ScopeTree | undefined {
  if (path.length === 0) {
    if (env.has(key)) {
      return { env: new Map([...env, [key, val]]), children };
    }
    return;
  }
  else {
    // follow path
    const [childId, ...rest] = path;
    let updated;
    if (Object.hasOwn(children, childId)) {
      updated = updateST(rest, key, val, children[childId]);
    }
    if (updated === undefined) {
      // attempt overwrite in parent (yes that's us)
      return updateST([], key, val, {env, children});
    }
    else {
      return {
        env,
        children: { ...children, [childId]: updated },
      }
    }
  }
}

export function* iterST({env, children}: ScopeTree): IterableIterator<[string, any]> {
  for (const [key, val] of env) {
    yield [key, val];
  }
  for (const [childId, child] of Object.entries(children)) {
    for (const [key, val] of iterST(child)) {
      yield [childId+'.'+key, val];
    }
  }
}
