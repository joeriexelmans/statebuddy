import { CSSProperties } from "react";
import { Lhs, TextRange, visitExpression, visitLhs } from "../../actionlang/abstract_syntax";
import { parseText } from "./parser/parser";
import { SCExpression, visitSCExpression } from "./abstract_syntax";

export type RangeWithAnnotation = TextRange & {
  style: CSSProperties;
  tooltip?: string;
}

export const keywordStyle: CSSProperties = {
  color: 'light-dark( #8800adff , #efb4ffff)',
  fill: 'light-dark( #8800adff , #efb4ffff)',
  // fontWeight: 'bold',
} as CSSProperties;

export const errorStyle: CSSProperties = {
  color: 'red',
  fill: 'red',
  fontWeight: 'bold',
} as CSSProperties;

export const refStyle: CSSProperties = {
  color: 'light-dark( #008064ff , #3becc6ff)',
  fill: 'light-dark( #008064ff , #3becc6ff)',
} as CSSProperties;

export const literalStyle: CSSProperties = {
  color: 'light-dark( #855b0eff , #fcc96bff)',
  fill: 'light-dark( #855b0eff , #fcc96bff)',
} as CSSProperties;

export const commentStyle: CSSProperties = {
  color: 'light-dark( #1f7a00ff , #aef597ff)',
  fill: 'light-dark( #1f7a00ff , #aef597ff)',
  fontStyle: 'italic',
} as CSSProperties;

export const tagStyle: CSSProperties = {
  color: 'light-dark( rgb(0, 146, 209) , rgb(151, 202, 224))',
  fill: 'light-dark( rgb(0, 146, 209) , rgb(151, 202, 224))',
  // fontWeight: 800,
  // fontStyle: 'italic',
}

function addAndCheck(ranges: TextRange[], range: TextRange | RangeWithAnnotation) {
  // if (range.start === range.end) {
  //   console.error(range);
  //   throw new Error('invalid range')
  // }
  ranges.push(range);
}


export function syntaxHighlight(text: string) {
  // let parsedText: ParsedText | undefined;
  let parseError: SyntaxError | undefined;
  let errorRanges: RangeWithAnnotation[] = [];
  const [parsedText, treesitterErrors] = parseText(text);
  // we only display the first error because we don't have a good way displaying more than one.
  // also we cannot deal with overlapping error ranges currently.
  for (const err of treesitterErrors.slice(0,1)) {
    addAndCheck(errorRanges, {
      ...err.range,
      tooltip: err.message,
      style: errorStyle,
    })
  }
  // find all keyword positions so we can give them a nice color :)
  let keywordRanges: TextRange[] = [];
  let literalRanges: TextRange[] = [];
  let refRanges: TextRange[] = [];
  let commentRanges: TextRange[] = [];
  let tagRanges: TextRange[] = [];

  const findAtoms = (thing: SCExpression | Lhs) => {
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
    else if (thing.kind === "tag") {
      if (thing.range) {
        addAndCheck(tagRanges, thing.range);
      }
    }
    else if (thing.kind === "lhsDict") {
      // todo
    }
    else if (thing.kind === "lhsArray") {
      // todo
    }
    else if (thing.kind !== "unexpected") {
      visitSCExpression(thing, findAtoms);
    }
  };

  if (parsedText) {
    if (parsedText.kind === "transitionLabel") {
      if (parsedText.trigger.kind === "after") {
        addAndCheck(keywordRanges, parsedText.trigger.rangeAfter)
      }
      else if (parsedText.trigger.kind === "event") {
        if (parsedText.trigger.param) {
          visitLhs(parsedText.trigger.param, findAtoms);
        }
      }
      else if (parsedText.trigger.kind === "entry" || parsedText.trigger.kind === "exit") {
        addAndCheck(keywordRanges, parsedText.trigger.range)
      }
      findAtoms(parsedText.guard);

      for (const a of parsedText.actions) {
        if (a.kind === "assignment") {
          findAtoms(a.rhs);
          visitLhs(a.lhs, findAtoms);
        }
        else if (a.kind === "raise") {
          if (a.param) {
            findAtoms(a.param);
          }
        }
      }
    }
    else if (parsedText.kind === "comment") {
      addAndCheck(commentRanges, parsedText.range);
    }
    else if (parsedText.kind === "tag") {
      addAndCheck(tagRanges, parsedText.range)
    }
  }

  return {
    ranges: [
      ...keywordRanges.map(r => ({...r, style: keywordStyle, fragment: text.slice(r.start, r.end)})),
      ...literalRanges.map(l => ({...l, style: literalStyle, fragment: text.slice(l.start, l.end)})),
      ...refRanges.map(r => ({...r, style: tagStyle, fragment: text.slice(r.start, r.end)})),
      ...commentRanges.map(c => ({...c, style: commentStyle, fragment: text.slice(c.start, c.end)})),
      ...tagRanges.map(r => ({...r, style: tagStyle, fragment: text.slice(r.start, r.end)})),
      ...errorRanges,
    ].sort((a,b) => (a.start - b.start)) as RangeWithAnnotation[],
    parseError,
    parsed: parsedText,
  }
}