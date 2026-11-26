import { Parser, Language, Node } from "web-tree-sitter";
import wasmURL from "./parser.wasm?url";
import { Action, ParsedText, SCExpression, TransitionLabel, Trigger } from "../abstract_syntax";
import { treeToAssignment, treeToExpression, treeToLhs, range, getSyntaxErrors } from "@/languages/actionlang/parser/parser";

await Parser.init();
const parser = new Parser();
const lang =  await Language.load(wasmURL);
parser.setLanguage(lang);

export type TreeSitterError = {
  message: string,
  range: { start: number, end: number, },
}

export function parseText(text: string): [ParsedText, TreeSitterError[]] {
  const tree = parser.parse(text)!;
  // console.log(text, '\n', tree.rootNode.toString());
  const errors = getSyntaxErrors(tree.rootNode);
  const parsedText = treeToText(tree.rootNode);
  // console.log(parsedText);
  return [parsedText, errors];
}

export function treeToText(root: Node): ParsedText {
  const ch = root.childForFieldName('text');
  if (!ch) {
    return {
      kind: "parserError",
      uid: "UNKNOWN",
    }
  }
  switch (ch.type) {
    case "tag":
      return {
        kind: "tag",
        text: ch.text,
        range: { start: ch.startIndex, end: ch.endIndex },
        uid: "UKNNOWN", // filled in later
      };
    case "comment":
      return {
        kind: "comment",
        text: ch.text,
        range: { start: ch.startIndex, end: ch.endIndex },
        uid: "UKNNOWN", // filled in later
      };
    case "label":
    case "triggerlesslabel":
    case "actiononlylabel":
      return treeToLabel(ch);
    default:
      console.warn(root.toString());
      throw new Error("unknown type: " + ch.type);
  }
}

function treeToLabel(label: Node): TransitionLabel {
  const trigger = label.childForFieldName("trigger");
  const guard = label.childForFieldName("guard");
  const actions = label.childForFieldName("actions");
  return {
    kind: "transitionLabel",
    trigger: trigger
      ? treeToTrigger(trigger)
      : {kind: "triggerless"},
    guard: guard
      ? treeToSCExpression(guard)
      : {kind: "literal", value: true }, // <-- no guard
    actions: actions
      ? treeToActions(actions)
      : [],
    uid: "UKNNOWN", // filled in later
  };
}

// Expands 'treeToExpression' with the possibility of an expression being a 'tag'.
function treeToSCExpression(expr: Node): SCExpression {
  if (expr.type === "tag") {
    return {
      kind: "tag",
      text: expr.text,
      range: range(expr),
    }
  }
  return treeToExpression(expr, treeToSCExpression);
}

function treeToTrigger(trigger: Node): Trigger {
  switch (trigger.type) {
    case "afterTrigger":
      const after = trigger.childForFieldName("after")!;
      const duration = trigger.childForFieldName("duration")!;
      const durationNumber = Number(duration.text);
      const unit = trigger.childForFieldName("unit")!;
      return {
        kind: "after",
        durationMs: (unit.text === "ms") ? durationNumber : durationNumber*1000,
        rangeAfter: range(after),
        rangeNumber: range(duration),
        rangeUnit: range(unit),
      };
    case "entryTrigger":
      return {
        kind: "entry",
        range: range(trigger),
      };
    case "exitTrigger":
      return {
        kind: "exit",
        range: range(trigger),
      };
    case "eventTrigger":
      const event = trigger.childForFieldName("event")!;
      const param = trigger.childForFieldName("param") || undefined;
      return {
        kind: "event",
        event: event.text,
        param: param && treeToLhs(param),
      };
    default:
      throw new Error("unknown trigger type: " + trigger.type);
  }
}

function treeToActions(actions: Node): Action[] {
  return actions.childrenForFieldName('action').map(action => {
    switch (action.type) {
      case "assignment":
        return treeToAssignment(action, treeToSCExpression);
      case "raise":
        const event = action.childForFieldName("event")!;
        const param = action.childForFieldName("param") || undefined;
        return {
          kind: "raise",
          event: event.text,
          param: param && treeToSCExpression(param),
        }
      default:
        throw new Error("unknown action type: " + action.type + ", node: " + JSON.stringify(action.text));
    }
  })
}
