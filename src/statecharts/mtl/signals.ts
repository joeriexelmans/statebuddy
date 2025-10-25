// Ported from https://github.com/mvcisback/DiscreteSignals/blob/main/discrete_signals/signals.py

import { _evolve } from "./helpers";


type Time = number;
type KeyType = any;
type ValueType = any;
type DataType = Map<Time, Map<KeyType, ValueType>>;

export class DiscreteSignal {
  data: DataType;
  start: Time;
  end: Time;

  constructor(data: DataType, start: Time, end: Time) {
    this.data = data;
    this.start = start;
    this.end = end;
  }

  values() {
    return this.data.values();
  }
  times() {
    return this.data.keys();
  }
  entries() {
    return this.data.entries();
  }

  tags() {
    return new Set([].concat(...[...this.values()]));
  }

  rshift(delta: Time) {
    return _evolve(this,
      {
        data: new Map(...this.data.entries().map(([time, val]) => [time+delta, val] as [Time, any])),
        start: this.start + delta,
        end: this.end + delta,
      }
    )
  }

  lshift(delta: Time) {
    return this.rshift(-delta);
  }

  matmul(other) {
    return _evolve(this,
      {
        data: new Map([
          ...this.data.entries(),
          ...other.data.entries().map(([time, val]) => [time+this.end, val]),
        ]),
        end: this.end + (other.end - other.start),
      }
    )
  }

  __or__(other) {
    return _evolve(this,
      {
        // merge all data:
        data: new Map([...new Set([...this.data.keys(), ...other.data.keys()])].map(key => [key, new Map([
          ...this.data.get(key)?.entries() || [],
          ...other.data.get(key)?.entries() || [],
        ])])),
        start: Math.min(this.start, other.start),
        end: Math.max(this.end, other.end),
      }
    )
  }

  slice(start?: number, end?: number) {
    const s = (start === undefined) ? this.start : start;
    const e = (end === undefined) ? this.end : end;
    return _evolve(this, {
      data: new Map([...this.data.entries().filter(([time]) => time >= s && time < e)]),
      start: s,
      end: e,
    })
  }

  get(key: number) {
    return this.data.get(key);
  }

  rolling(start: number, end: number) {
    if (start !== 0) {
      const delta = (end !== Infinity) ? (end - start) : end
      return this.rolling(0, delta).lshift(start);
    }

    const apply_window = ([t, _]) => {
      const values = this.slice(start+t, end+t).values();
      return [t, values];
    }

    return _evolve(this, {
      data: new Map([...this.data.entries().map((entry) => apply_window(entry))]),
      end: (end < this.end) ? (this.end - end) : this.end,
    })
  }

  transform(f: (val: Map<KeyType,ValueType>) => Map<KeyType,ValueType>) {
    const data = new Map([
      ...this.data.entries().map(([key, val]) =>
        [key, f(val)] as [Time, any])]);
    return _evolve(this, {
      data,
    });
  }

  map(f: (val: Map<KeyType,ValueType>) => Map<KeyType,ValueType>, tag=null) {
    const data = new Map([
      ...this.data.entries().map(([key, val]) =>
        [key, f(val)] as [Time, any])]);
    return signal(data, this.start, this.end, tag);
  }


  filter(f: (val: Map<KeyType,ValueType>) => boolean) {
    return _evolve(this, {
      data: new Map([...this.data.entries().filter(([_, val]) => f(val))]),
    });
  }

  project(keys: Set<KeyType>) {
    return this
      .transform(val => new Map([...val.entries()].filter(([key]) => keys.has(key))))
      .filter(val => keys.intersection(val.keys()).size > 0);
  }

  retag(mapping: Map<KeyType, KeyType>) {
    return this.transform(val =>
      new Map([...val.entries().map(([key,val]) =>
        [mapping.get(key), val] as [KeyType, ValueType])]));
  }
}

export function signal(data: Iterable<[number, number]>, start=0, end=Infinity, tag:any = 'null') {
  return new DiscreteSignal(
    new Map([...data].map(([time, value]) => [time, new Map([[tag, value]])])),
    start,
    end
  ).slice(start, end);
}
