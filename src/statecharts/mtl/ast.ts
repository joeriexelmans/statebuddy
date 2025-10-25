import { _evolve } from "./helpers";

type MTL_Node = any;

function flatten_binary(phi: NaryOpMTL, op, dropT, shortT) {
  const args = phi.args.filter(arg => arg !== dropT);

  if (args.some((arg: MTL_Node) => arg === shortT)) {
    return shortT;
  }
  if (args.length === 0) {
    return dropT;
  }
  if (args.length === 1) {
    return args[0];
  }

  function f(x) {
    if (x instanceof op) {
      return x.args;
    }
    else {
      return [x];
    }
  }

  return op(phi.args.flatMap(f))
}

function _neg(expr: MTL_Node) {
  if (expr instanceof Neg) {
    return expr.arg;
  }
  return new Neg(expr);
}

function _and(expr1: MTL_Node, expr2: MTL_Node) {
  return flatten_binary(new And([expr1, expr2]), And, TOP, BOT);
}

function _or(expr1: MTL_Node, expr2: MTL_Node) {
  return _neg(_and(_neg(expr1), _neg(expr2)))
}

function _eval(expr, trace, time=false, dt=0.1, quantitative=true) {
  return evaluator.pointwise_sat(expr, dt)(trace, time, quantitative);
}

function _timeshift(expr, t) {
  if (expr === BOT) {
    return expr;
  }
  for (let i=0; i<t; i++) {
    expr = new Next(expr);
  }
  return expr;
}

function* _walk(expr) {
  const children = [expr];
  while (children.length > 0) {
    const node = children.pop();
    yield node;
    children.push(...node.children);
  }
}

function _params(expr) {
  function* get_params(leaf) {
    if (leaf.interval[0] instanceof Param) {
      yield leaf.interval[0];
    }
    if (leaf.interval[1] instanceof Param) {
      yield leaf.interval[1];
    }
  }

  return new Set(_walk(expr).flatMap(e => [...get_params(e)]));
}

function _set_symbols(node, val) {
  const children = (node.children?.() || []).map(c => _set_symbols(c, val));

  if (node.interval) {
    return _evolve(node, {
      arg: children[0],
      interval: _update_itvl(node.interval, val),
    });
  }
  if (node instanceof AtomicPred) {
    return val.get(node.id, node);
  }
  if (node.args) {
    return _evolve(node, {
      args: children,
    });
  }
  if (node.arg) {
    return _evolve(node, {
      args: children,
    });
  }
  return node;
}

function _update_itvl(itvl, lookup) {
  function _update_param(p) {
    if (!(p instanceof Param) || !lookup.has(p.name)) {
      return p;
    }
    const val = lookup.get(p.name);
    if (lookup instanceof Param) {
      return val;
    }
    else {
      return Number(val);
    }
  }

  return new Interval(_update_param(itvl.lower), _update_param(itvl.upper));
}


function alw(phi: MTL_Node, lo=0, hi=Infinity) {
  return new G(new Interval(lo, hi), phi);
}

function env(phi: MTL_Node, lo=0, hi=Infinity) {
  return ~alw(~phi, lo, hi);
}

function implies(x, y) {
  return _neg(x) 
}



class AtomicPred {
  id: string;

  constructor(id: string) {
    this.id = id;
  }
}

class Interval {
  lower: number | Param;
  upper: number | Param;

  constructor(lower: number | Param, uppper: number | Param) {
    this.lower = lower;
    this.upper = uppper;
  }
}

class Param {
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

class _Bot {}

class NaryOpMTL {
  OP = "?";
  args: MTL_Node[];

  constructor(args: MTL_Node[]) {
    this.args = args;
  }

  children() {
    return this.args;
  }
}

class And extends NaryOpMTL {
  OP = "&";
}

class ModalOp {
  OP = "?";
  interval: Interval;
  arg: MTL_Node

  constructor(interval: Interval, arg: MTL_Node) {
    this.interval = interval;
    this.arg = arg;
  }

  children() {
    return [this.arg];
  }
}

class G extends ModalOp {
  OP = "G";
}

class WeakUntil {
  arg1: MTL_Node;
  arg2: MTL_Node;

  constructor(arg1: MTL_Node, arg2: MTL_Node) {
    this.arg1 = arg1;
    this.arg2 = arg2;
  }

  children() {
    return [this.arg1, this.arg2];
  }
}

class Neg {
  arg: MTL_Node;

  constructor(arg: MTL_Node) {
    this.arg = arg;
  }

  children() {
    return [this.arg];
  }
}

class Next {
  arg: MTL_Node

  constructor(arg: MTL_Node) {
    this.arg = arg;
  }


  children() {
    return [this.arg];
  }
}

function type_pred(...args) {
  const ast_types = new Set(args);
  return (x: any) => ast_types.has(x.constructor);
}

export const BOT = new _Bot();
export const TOP = _neg(BOT);