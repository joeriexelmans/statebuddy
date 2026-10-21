// Typescript definitions for the abstract syntax for our action language.

// for traceability to textual concrete syntax
export type TextRange = {
  start: number,
  end: number,
}

export type Lhs = LhsRef | LhsDict | LhsArray | LhsLiteral;

export type LhsRef = {
  kind: "lhsRef",
  variable: string,
  range?: TextRange,
}

export type LhsDict = {
  kind: "lhsDict",
  fields: {
    [fieldname: string]: Lhs,
  },
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

export type Expression = BinaryExpression | UnaryExpression | VarRef | StateRef | Literal | FunctionCall | DictExpression | ArrayExpression;

export type BinaryExpression = {
  kind: "binaryExpr";
  operator: "+" | "-" | "*" | "/" | "&&" | "||";
  lhs: Expression;
  rhs: Expression;
}

export type UnaryExpression = {
  kind: "unaryExpr";
  operator: "!" | "-";
  expr: Expression;
}

export type VarRef = {
  kind: "ref";
  variable: string;
  range?: TextRange,
}

export type StateRef = {
  kind: "tag";
  text: string;
  range?: TextRange,
}

export type Literal = {
  kind: "literal";
  value: boolean | number | string;
  range?: TextRange;
}

export type FunctionCall = {
  kind: "call",
  fn: VarRef,
  param: Expression,
}

export type DictExpression = {
  kind: "dict",
  fields: {
    [fieldname: string]: Expression,
  },
}

export type ArrayExpression = {
  kind: "array",
  elements: Expression[],
}

export function visitExpression(expr: Expression, callback: (expr: Expression) => void) {
  callback(expr);
  if (expr.kind === "literal" || expr.kind === "ref" || expr.kind === "unaryExpr") {
  }
  else if (expr.kind === "binaryExpr") {
    visitExpression(expr.lhs, callback);
    visitExpression(expr.rhs, callback);
  }
  else if (expr.kind === "array") {
    for (const el of expr.elements) {
      visitExpression(el, callback);
    }
  }
  else if (expr.kind === "call") {
    visitExpression(expr.param, callback);
  }
  else if (expr.kind === "dict") {
    for (const val of Object.values(expr.fields)) {
      visitExpression(val, callback);
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
