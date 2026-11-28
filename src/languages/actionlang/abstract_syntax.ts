// Typescript definitions for the abstract syntax for our action language.

// for traceability to textual concrete syntax
export type TextRange = {
  start: number,
  end: number,
}

export type Unexpected = {
  kind: "unexpected",
  text: string,
  range: TextRange,
}

export type Lhs = LhsRef | LhsDict | LhsArray | LhsLiteral
  | Unexpected; // <-- i observed that the LHS "[A]" (= an array of "A" -- "A" cannot be parsed because identifiers must start lowercase) still produces a LhsArray with an 'unexpected input' of "A" ... so we make the best of it.

export type LhsRef = {
  kind: "lhsRef",
  variable: string,
  range?: TextRange,
}

export type LhsDict = {
  kind: "lhsDict",
  fields: Map<string, Lhs>,
}

export type LhsArray = {
  kind: "lhsArray",
  elements: Lhs[],
}

export type LhsLiteral = {
  kind: "lhsLiteral",
  value: number | boolean | string,
  range?: TextRange,
}

export type BaseExpression<E> = BinaryExpression<E> | UnaryExpression<E> | VarRef | Literal | FunctionCall<E> | DictExpression<E> | ArrayExpression<E>;

export interface BinaryExpression<E> {
  kind: "binaryExpr";
  operator: "+" | "-" | "*" | "/" | "&&" | "||";
  lhs: E;
  rhs: E;
}

export interface UnaryExpression<E> {
  kind: "unaryExpr";
  operator: "!" | "-";
  expr: E;
}

export interface VarRef {
  kind: "ref";
  variable: string;
  range?: TextRange,
}

export interface Literal {
  kind: "literal";
  value: boolean | number | string;
  range?: TextRange;
}

export interface FunctionCall<E> {
  kind: "call",
  fn: E,
  param: E,
}

export interface DictExpression<E> {
  kind: "dict",
  fields: Map<string, E>,
}

export interface ArrayExpression<E> {
  kind: "array",
  elements: E[],
}

export interface Assignment<E> {
  kind: "assignment";
  lhs: Lhs;
  rhs: E;
};

export function visitExpression<E>(
  expr: BaseExpression<E>,
  rec: (sub: E) => void,
) {
  if (expr.kind === "literal" || expr.kind === "ref" || expr.kind === "unaryExpr") {
  }
  else if (expr.kind === "binaryExpr") {
    rec(expr.lhs);
    rec(expr.rhs);
  }
  else if (expr.kind === "array") {
    for (const el of expr.elements) {
      rec(el);
    }
  }
  else if (expr.kind === "call") {
    rec(expr.fn);
    rec(expr.param);
  }
  else if (expr.kind === "dict") {
    for (const val of Object.values(expr.fields)) {
      rec(val);
    }
  }
}

export function visitLhs(lhs: Lhs, callback: (expr: Lhs) => void) {
  callback(lhs);
  if (lhs.kind === "lhsLiteral" || lhs.kind === "lhsRef") {
  }
  else if (lhs.kind === "lhsArray") {
    for (const el of lhs.elements) {
      visitLhs(el, callback);
    }
  }
  else if (lhs.kind === "lhsDict") {
    for (const val of Object.values(lhs.fields)) {
      visitLhs(val, callback);
    }
  }
}

export function getLhsRefs(lhs: Lhs): Set<string> {
  if (lhs.kind === "lhsLiteral") {
    return new Set();
  }
  else if (lhs.kind === "lhsRef") {
    return new Set([lhs.variable]);
  }
  else if (lhs.kind === "lhsArray") {
    return new Set(...lhs.elements.map(getLhsRefs));
  }
  else if (lhs.kind === "lhsDict") {
    return new Set(...Object.entries(lhs.fields).map(([_, lhs]) => getLhsRefs(lhs)));
  }
  throw new Error("should never reach here");
}


//    x = x+1
//    [x,y] = [1,2]

//    [x,2] = [1,2]   // OK
//    [x,3] = [1,2]   // run-time assertion error

//    # assert that my_var is true
//    True = my_var

//    # assign True to my_var
//    my_var = True


//   in_event(param) [guard] / actions

        // in_event: identifier
        // param: LHS
        // guard: expr
        // actions: stmt*
        // stmt = assignment
        // assignment = LHS "=" expr

// doorOpen(x) [x==True] / x=x+1

// doorOpen(True) / x = x+1

// recv doorOpen(False) -> cannot match with doorOpen(True)

