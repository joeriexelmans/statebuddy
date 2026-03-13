// Basically the inverse of our parser

import { Expression, Lhs } from "./label_ast";

export function actionLangValToText(val: any): string {
  if (typeof val === "string" || typeof val === "number") {
    return JSON.stringify(val);
  }
  if (typeof val === "boolean") {
    return val ? "True" : "False";
  }
  if (Array.isArray(val)) {
    return `[${val.map(el => actionLangValToText(el)).join(', ')}]`;
  }
  if (val && typeof val === "object") {
    return `{${Object.entries(val).map(([key, val]) => `${key}: ${actionLangValToText(val)}`).join(', ')}}`;
  }
  console.error('value was', val);
  throw new Error("should never reach here");
}

export function actionLangLhsToText(lhs: Lhs): string {
  if (lhs.kind === "lhsRef") {
    return lhs.variable;
  }
  if (lhs.kind === "lhsLiteral") {
    return actionLangValToText(lhs.value);
  }
  if (lhs.kind === "lhsArray") {
    return `[${lhs.elements.map(el => actionLangLhsToText(el)).join(', ')}]`;
  }
  if (lhs.kind === "lhsDict") {
    const entry = (key: string, val: string) => {
      if (key === val) { return key }
      else { return `${key}: ${val}`}
    }
    return `{${Object.entries(lhs.fields)
      .map(([key, val]) => entry(key, actionLangLhsToText(val))).join(', ')}}`;
  }
  console.error('lhs was', lhs);
  throw new Error("should never reach here");
}