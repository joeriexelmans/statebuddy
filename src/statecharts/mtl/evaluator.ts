import { BOT, TOP } from "./ast";
import { DiscreteSignal, signal } from "./signals";

const CONST_FALSE = signal([[0,-1]], -Infinity, Infinity, BOT);
const CONST_TRUE = signal([[0, 1]], -Infinity, Infinity, TOP);

export function eval_mtl_until(phi, dt) {
  
}

export function eval_mtl_g(phi, dt) {
  const f = eval_mtl(phi.arg, dt);
  const [a,b] = phi.interval;
  if (b < a) {
    return _ => CONST_TRUE.retag(new Map([[TOP, phi]]));
  }
  function _min(val) {
    return Math.min(...val[phi.arg]);
  }
  return x => {
    let tmp: DiscreteSignal = f(x);
    if (b < a) throw new Error("assertion failed");
    if (b > a) {
      if (b < Infinity) {
        const ts = tmp.times().map(t => interp_all(tmp, t-b-a+dt, tmp.end));
        tmp = ts.reduce((a,b) => a.__or__(b), tmp).slice(tmp.start, tmp.end);
      }
      return tmp.rolling(a,b).map(_min, phi);
    }
    return tmp.retag(new Map([[phi.arg, phi]]));
  }
}

export function eval_mtl_neg(phi, dt) {
  const f = eval_mtl(phi.arg, dt);
  return x => f(x).map(v => -v[phi.arg], phi);
}

export function eval_mtl_next(phi, dt) {
  const f = eval_mtl(phi.arg, dt);
  return x => f(x).lshift(dt).retag(new Map([[phi.arg, phi]]));
}

export function eval_mtl_ap(phi, _) {
  return (x: DiscreteSignal) => x.project(new Set([phi.id]).retag(new Map([[phi.id, phi]])));
}

export function eval_mtl_bot(_, _1) {
  return () => CONST_FALSE
}
