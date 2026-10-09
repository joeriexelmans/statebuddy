import { AbstractState, stateDescription, Transition, transitionDescription } from "./abstract_syntax";

export type Scope = {
  kind: "transition",
  thing: Transition,
} | {
  kind: "state",
  thing: AbstractState,
};

export function scopeDescription(scope: Scope) {
  return scope.kind === "state" ? `(${stateDescription(scope.thing)})` : `(${transitionDescription(scope.thing)})`;
}

export type Environment = {
  // force creation of a new variable in the current scope, even if a variable with the same name already exists in a surrounding scope
  newVar(key: string, value: any, scope: Scope): Environment;

  // (over)write variable. creates the variable in the current scope if it doesn't exist yet.
  set(key: string, value: any, scope: Scope): Environment;

  // read variable
  get(key: string, scope: Scope): any;

  entries(scope?: Scope): IterableIterator<[string, any]>;

  clearScope(scope: Scope): Environment;
}

// non-hierarchical environment with only global variables
// consistent with the UA MoSIS course on Statecharts
export class FlatEnvironment {
  env: ReadonlyMap<string, any>;

  constructor(env: ReadonlyMap<string, any> = new Map()) {
    this.env = env;
  }

  newVar(key: string, value: any, scope: Scope) {
    return this.set(key, value, scope);
  }
  set(key: string, value: any, scope: Scope) {
    return new FlatEnvironment(new Map([...this.env, [key, value]]));
  }
  get(key: string, scope: Scope): any {
    return this.env.get(key);
  }

  entries(): IterableIterator<[string, any]> {
    return this.env.entries();
  }

  clearScope(scope: Scope): Environment {
    return this;
  }
}

function pureUpdate<K,V>(m: ReadonlyMap<K,V>, key: K, val: V|undefined) {
  if (val === undefined) {
    // delete key from map
    const result = new Map([
      ...m.entries().filter(([k, _]) => k !== key),
    ]);
    return result;
    
  }
  // add entry
  return new Map([
    ...m,
    [key, val]
  ]);
}

export class ScopedEnvironment {
  env: ReadonlyMap<string, ReadonlyMap<string, any>>; // (state|transition)-uid -> name -> value
  scopes: ReadonlyMap<string, Scope>; // (state|transtion)-uid -> Scope

  constructor(env: ReadonlyMap<string, any> = new Map(), scopes: ReadonlyMap<string, Scope>) {
    this.env = env;
    this.scopes = scopes;
  }

  newVar(key: string, value: any, scope: Scope) {
    return new ScopedEnvironment(
      pureUpdate(this.env, scope.thing.uid,
        pureUpdate(this.env.get(scope.thing.uid) || new Map(), key, value)
      ),
      pureUpdate(this.scopes, scope.thing.uid, scope),
    );
  }

  #findScope(key: string, scope: Scope): [Scope, any] | undefined {
    const m = this.env.get(scope.thing.uid);
    if (m !== undefined) {
      const val = m.get(key);
      if (val !== undefined) {
        return [scope, val];
      }
    }
    if (scope.kind === "state") {
      const parentState = scope.thing.parent;
      if (parentState) {
        return this.#findScope(key, {kind: "state", thing: parentState});
      }
      
    }
    else { // transition
      return this.#findScope(key, {kind: "state", thing: scope.thing.arena});
    }
  }

  set(key: string, value: any, scope: Scope) {
    const found = this.#findScope(key, scope);
    if (!found) {
      return this.newVar(key, value, scope);
    }
    else {
      const [foundScope] = found;
      return new ScopedEnvironment(
        pureUpdate(this.env, foundScope.thing.uid,
          pureUpdate(this.env.get(foundScope.thing.uid) || new Map(), key, value)),
        pureUpdate(this.scopes, foundScope.thing.uid, foundScope),
      );
    }
  }

  get(key: string, scope: Scope) {
    const found = this.#findScope(key, scope);
    if (found) {
      const [_, val] = found;
      return val;
    }
  }

  *entries(scope?: Scope): IterableIterator<[string, any]> {
    if (scope) {
      const uid = scope.thing.uid;
      for (const [name, value] of (this.env.get(uid)||[]).entries()) {
        yield [scopeDescription(scope)+'.'+name, value];
      }
    }
    else {
      for (const [uid, env] of this.env.entries()) {
        for (const [name, value] of env.entries()) {
          yield [scopeDescription(this.scopes.get(uid)!)+'.'+name, value];
        }
      }
    }
  }

  clearScope(scope: Scope) {
    return new ScopedEnvironment(
      pureUpdate(this.env, scope.thing.uid, undefined),
      pureUpdate(this.scopes, scope.thing.uid, undefined),
    );
  }
}
