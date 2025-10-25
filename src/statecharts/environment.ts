import { getST, iterST, ScopeTree, updateST, writeST } from "./scope_tree";

export type Environment = {
  enterScope(scopeId: string): Environment;
  exitScope(): Environment;

  // force creation of a new variable in the current scope, even if a variable with the same name already exists in a surrounding scope
  newVar(key: string, value: any): Environment;

  // (over)write variable
  set(key: string, value: any): Environment;

  // read variable
  get(key: string): any;

  entries(): IterableIterator<[string, any]>;
}


// non-hierarchical environment with only global variables
// consistent with the UA MoSIS course on Statecharts
export class FlatEnvironment {
  env: ReadonlyMap<string, any>;

  constructor(env: ReadonlyMap<string, any> = new Map()) {
    this.env = env;
  }

  enterScope(scopeId: string): FlatEnvironment {
    return this;
  }
  exitScope(): FlatEnvironment {
    return this;
  }

  newVar(key: string, value: any) {
    return this.set(key, value);
  }
  set(key: string, value: any) {
    return new FlatEnvironment(new Map([...this.env, [key, value]]));
  }
  get(key: string): any {
    return this.env.get(key);
  }

  entries(): Iterator<[string, any]> {
    return this.env.entries();
  }
}

// A scoped environment
// IMO better, but harder to explain
export class ScopedEnvironment {
  scopeTree: ScopeTree;
  current: string[];

  constructor(scopeTree: ScopeTree = { env: new Map(), children: {} }, current: string[] = []) {
    this.scopeTree = scopeTree;
    this.current = current;
  }

  enterScope(scopeId: string): ScopedEnvironment {
    return new ScopedEnvironment(
      this.scopeTree,
      [...this.current, scopeId],
    );
  }
  exitScope() {
    return new ScopedEnvironment(
      this.scopeTree,
      this.current.slice(0, -1),
    );
  }

  newVar(key: string, value: any): ScopedEnvironment {
    return new ScopedEnvironment(
      writeST(key, value, this.current, this.scopeTree),
      this.current,
    );
  }

  // update variable in the innermost scope where it exists, or create it in the current scope if it doesn't exist yet
  set(key: string, value: any): ScopedEnvironment {
    let updated = updateST(this.current, key, value, this.scopeTree);
    if (updated === undefined) {
      updated = writeST(key, value, this.current, this.scopeTree);
    }
    return new ScopedEnvironment(
      updated,
      this.current,
    )
  }

  // lookup variable, starting in the currrent (= innermost) scope, then looking into surrounding scopes until found.
  get(key: string): ScopedEnvironment {
    return getST(this.current, key, this.scopeTree);
  }

  *entries(): Iterator<[string, any]> {
    return iterST(this.scopeTree);
  }
}
