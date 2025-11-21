import { AbstractState, Transition } from "./abstract_syntax";

export type Scope = {
  kind: "transition",
  thing: Transition,
} | {
  kind: "state",
  thing: AbstractState,
};

export type Environment = {
  // force creation of a new variable in the current scope, even if a variable with the same name already exists in a surrounding scope
  newVar(key: string, value: any, scope: Scope): Environment;

  // (over)write variable
  set(key: string, value: any, scope: Scope): Environment;

  // read variable
  get(key: string, scope: Scope): any;

  entries(): IterableIterator<[string, any]>;
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
}

function pureUpdate<K,V>(m: ReadonlyMap<K,V>, key: K, val: V) {
  return new Map([
    ...m,
    [key, val]
  ]);
}

export class ScopedEnvironment {
  env: ReadonlyMap<string, ReadonlyMap<string, any>>; // (state|transition)-uid -> name -> value

  constructor(env: ReadonlyMap<string, any> = new Map()) {
    this.env = env;
  }

  newVar(key: string, value: any, scope: Scope) {
    return new ScopedEnvironment(
      pureUpdate(this.env, scope.thing.uid,
        pureUpdate(this.env.get(scope.thing.uid) || new Map(), key, value)
      ));
  }

  #findScope(key: string, scope: Scope): [Scope, any] | undefined {
    const m = this.env.get(scope.thing.uid);
    if (m !== undefined) {
      return [scope, m];
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
      return new ScopedEnvironment(pureUpdate(this.env, foundScope.thing.uid,
        pureUpdate(this.env.get(foundScope.thing.uid) || new Map(), key, value)
      ));
    }
  }

  get(key: string, scope: Scope) {
    const found = this.#findScope(key, scope);
    if (found) {
      const [_, val] = found;
      return val;
    }
  }
}
