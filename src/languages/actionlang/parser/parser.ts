import { Node } from "web-tree-sitter";
import { Assignment, BaseExpression, BinaryExpression, Lhs, TextRange, UnaryExpression } from "../abstract_syntax";

export function treeToAssignment<E>(a: Node, nestedTreeToExpr: (n: Node) => E): Assignment<E> {
  return {
    kind: "assignment",
    lhs: treeToLhs(field(a, "left")),
    rhs: nestedTreeToExpr(field(a, "right")),
  };
}

export function treeToLhs(n: Node): Lhs {
  if (n.isError) {
    return { kind: "error", text: n.text, range: range(n) };
  }
  switch (n.type) {
    case "identifier":
      return { kind: "lhsRef", variable: n.text, range: range(n) };
    case "number": case "boolean": case "string":
      return { kind: "lhsLiteral", value: treeToLiteralValue(n), range: range(n) };
    case "lhs_array":
      return {
        kind: "lhsArray",
        elements: n.namedChildren.map(treeToLhs),
      };
    case "lhs_dict":
      return {
        kind: "lhsDict",
        fields: new Map(n.namedChildren.map((f) => {   // pattern_field
          const key = field(f, "key");
          const value = f.childForFieldName("value");
          return [key.text, treeToLhs(value!)];
        })),
      };
    default:
      throw new Error(`unexpected LHS: ${n.type}`);
  }
}

export function treeToExpression<E>(n: Node, nestedTreeToExpr: (n: Node) => E): BaseExpression<E> | E {
  switch (n.type) {
    case "identifier":
      return { kind: "ref", variable: n.text, range: range(n) };
    case "number": case "boolean": case "string":
      return { kind: "literal", value: treeToLiteralValue(n), range: range(n) };
    case "parenthesized_expression":
      return nestedTreeToExpr(n.namedChildren[0]);
    case "binary_expression":
      return {
        kind: "binaryExpr",
        operator: field(n, "operator").text,
        lhs: nestedTreeToExpr(field(n, "left")),
        rhs: nestedTreeToExpr(field(n, "right")),
        range: range(n),
      } as BinaryExpression<E>;
    case "unary_expression":
      return {
        kind: "unaryExpr",
        operator: field(n, "operator").text,
        expr: nestedTreeToExpr(field(n, "operand")),
        range: range(n),
      } as UnaryExpression<E>;
    case "call_expression":
      return {
        kind: "call",
        fn: nestedTreeToExpr(field(n, "function")),
        param: nestedTreeToExpr(field(n, "argument")),     // a parenthesized_expression, unwrapped above
      };
    case "array":
      return {
        kind: "array",
        elements: n.namedChildren.map(nestedTreeToExpr),
      };
    case "dict":
      return {
        kind: "dict",
        fields: new Map(n.namedChildren.map((f) => {     // dict_field
          const key = field(f, "key");
          const value = f.childForFieldName("value");
          return [key.text, nestedTreeToExpr(value!)];
        })),
      };
    default:
      throw new Error(`unexpected expression node: ${n.type}`);
  }
}

function treeToLiteralValue(n: Node): number | boolean | string {
  switch (n.type) {
    case "number": return parseInt(n.text, 10);
    case "boolean": return n.text === "True";
    case "string": return n.text.slice(1, -1);
    default: throw new Error(`not a literal: ${n.type}`);
  }
}


// helpers

export function getSyntaxErrors(root: Node): { message: string; range: TextRange }[] {
  const errors: { message: string; range: TextRange }[] = [];
  const walk = (n: Node) => {
    if (n.type === "ERROR") errors.push({ message: "unexpected input", range: range(n) });
    else if (n.isMissing) errors.push({ message: `missing ${n.type}`, range: range(n) });
    for (const c of n.children) if (c) walk(c);
  };
  if (root.hasError) walk(root);
  return errors;
}

export const range = (n: Node): TextRange => ({ start: n.startIndex, end: n.endIndex });

function field(n: Node, name: string): Node {
  const c = n.childForFieldName(name);
  if (!c) throw new Error(`${n.type} is missing field '${name}'`);
  return c;
}
