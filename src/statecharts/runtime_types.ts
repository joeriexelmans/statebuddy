export type Timestamp = number; // milliseconds since begin of simulation

export type RT_Event = InputEvent | TimerElapseEvent;

export type InputEvent = {
  kind: "input",
  name: string,
  param?: any,
}

export type TimerElapseEvent = {
  kind: "timer",
  state: string,
  timeDurMs: number,
}


export type Mode = Set<string>; // set of active states

export class Environment {
  scopes: ReadonlyMap<string, any>[]; // array of nested scopes - scope at the back of the array is used first

  constructor(env = [new Map()] as ReadonlyMap<string, any>[]) {
    this.scopes = env;
  }

  pushScope(): Environment {
    return new Environment([...this.scopes, new Map<string, any>()]);
  }

  popScope(): Environment {
    return new Environment(this.scopes.slice(0, -1));
  }

  // force creation of a new variable in the current scope, even if a variable with the same name already exists in a surrounding scope
  newVar(key: string, value: any): Environment {
    return new Environment(
      this.scopes.with(
        this.scopes.length-1,
        new Map([
          ...this.scopes[this.scopes.length-1],
          [key, value],
        ]),
      ));
  }

  // update variable in the innermost scope where it exists, or create it in the current scope if it doesn't exist yet
  set(key: string, value: any): Environment {
    for (let i=this.scopes.length-1; i>=0; i--) {
      const map = this.scopes[i];
      if (map.has(key)) {
        return new Environment(this.scopes.with(i, new Map([
          ...map.entries(),
          [key, value],
        ])));
      }
    }
    return new Environment(this.scopes.with(-1, new Map([
      ...this.scopes[this.scopes.length-1].entries(),
      [key, value],
    ])));
  }

  // lookup variable, starting in the currrent (= innermost) scope, then looking into surrounding scopes until found.
  get(key: string): any {
    for (let i=this.scopes.length-1; i>=0; i--) {
      const map = this.scopes[i];
      const found = map.get(key);
      if (found !== undefined) {
        return found;
      }
    }
  }

  transform<T>(key: string, upd: (old:T) => T, defaultVal: T): Environment {
    const old = this.get(key) || defaultVal;
    return this.set(key, upd(old));
  }

  *entries() {
    const visited = new Set();
    for (let i=this.scopes.length-1; i>=0; i--) {
      const map = this.scopes[i];
      for (const [key, value] of map.entries()) {
        if (!visited.has(key)) {
          yield [key, value];
          visited.add(key);
        }
      }
    }
  }
}

export type RT_History = Map<string, Set<string>>;

export type RT_Statechart = {
  mode: Mode;
  environment: Environment;
  history: RT_History; // history-uid -> set of states
}

export type BigStepOutput = RT_Statechart & {
  outputEvents: RaisedEvent[],
};

export type BigStep = {
  inputEvent: string | null, // null if initialization
  simtime: number,
} & BigStepOutput;

// internal or output event
export type RaisedEvent = {
  name: string,
  param?: any,
}

export type RaisedEvents = {
  internalEvents: RaisedEvent[];
  outputEvents: RaisedEvent[];
};

// export type Timers = Map<string, number>; // transition uid -> timestamp

export const initialRaised: RaisedEvents = {
  internalEvents: [],
  outputEvents: [],
};

export type Timers = [number, TimerElapseEvent][];
