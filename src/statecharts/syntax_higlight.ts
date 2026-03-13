import { CSSProperties } from "react";
import { Expression, Lhs, ParsedText, TextRange, visitExpression, visitLhs } from "./label_ast";
import { SyntaxError } from "./label_parser";
import { cachedParseLabel } from "./parser";

export type RangeWithAnnotation = TextRange & {
  style: CSSProperties;
  tooltip?: string;
}

export const keywordStyle = {
  color: '#862f9eff',
  fill: '#862f9eff',
  // fontWeight: 'bold',
} as CSSProperties;

export const errorStyle = {
  color: 'red',
  fill: 'red',
  fontWeight: 'bold',
} as CSSProperties;

export const literalStyle = {
  color: '#008064ff',
  fill: '#008064ff',
} as CSSProperties;

export const refStyle = {
  color: '#816228ff',
  fill: '#816228ff',
} as CSSProperties;

export const commentStyle = {
  color: '#2d7715ff',
  fill: '#2d7715ff',
  fontStyle: 'italic',
} as CSSProperties;

function addAndCheck(ranges: TextRange[], range: TextRange | RangeWithAnnotation) {
  // if (range.start === range.end) {
  //   console.error(range);
  //   throw new Error('invalid range')
  // }
  ranges.push(range);
}

export function syntaxHighlight(text: string) {
  let parsed: ParsedText | undefined;
  let parseError: SyntaxError | undefined;
  let errorRanges: RangeWithAnnotation[] = [];
  try {
    parsed = cachedParseLabel(text);
  } catch (e) {
    // @ts-ignore
    if (e instanceof SyntaxError) {
      parseError = e;
      console.log({e});
      addAndCheck(errorRanges, {start: e.location.start.offset, end: e.location.end.offset, tooltip: e.message, style: errorStyle});
    }
    else throw e;
  }

  // find all keyword positions so we can give them a nice color :)
  let keywordRanges: TextRange[] = [];
  let literalRanges: TextRange[] = [];
  let refRanges: TextRange[] = [];
  let commentRanges: TextRange[] = [];

  const visitLiterals = (thing: Expression | Lhs) => {
    if (thing.kind === "literal" || thing.kind === "lhsLiteral") {
      if (thing.range) {
        addAndCheck(literalRanges, thing.range);
      }
    }
    else if (thing.kind === "ref" || thing.kind === "lhsRef") {
      if (thing.range) {
        addAndCheck(refRanges, thing.range);
      }
    }
  };

  if (parsed) {
    if (parsed.kind === "transitionLabel") {
      if (parsed.trigger.kind === "after") {
        addAndCheck(keywordRanges, parsed.trigger.rangeAfter)
        // addAndCheck(keywordRanges, parsed.trigger.rangeUnit);
      }
      else if (parsed.trigger.kind === "event") {
        if (parsed.trigger.param) {
          visitLhs(parsed.trigger.param, visitLiterals);
        }
      }
      else if (parsed.trigger.kind === "entry" || parsed.trigger.kind === "exit") {
        addAndCheck(keywordRanges, parsed.trigger.range)
      }
      visitExpression(parsed.guard, visitLiterals);
      for (const a of parsed.actions) {
        if (a.kind === "assignment") {
          visitExpression(a.rhs, visitLiterals);
          visitLhs(a.lhs, visitLiterals);
        }
        else if (a.kind === "raise") {
          if (a.param) {
            visitExpression(a.param, visitLiterals)
          }
        }
      }
    }
    else if (parsed.kind === "comment") {
      addAndCheck(commentRanges, parsed.range);
    }
  }

  return {
    ranges: [
      ...keywordRanges.map(r => ({...r, style: keywordStyle, fragment: text.slice(r.start, r.end)})),
      ...literalRanges.map(l => ({...l, style: literalStyle, fragment: text.slice(l.start, l.end)})),
      ...refRanges.map(r => ({...r, style: refStyle, fragment: text.slice(r.start, r.end)})),
      ...commentRanges.map(c => ({...c, style: commentStyle, fragment: text.slice(c.start, c.end)})),
      ...errorRanges,
    ].sort((a,b) => (a.start - b.start)) as RangeWithAnnotation[],
    parseError,
    parsed,
  }
}