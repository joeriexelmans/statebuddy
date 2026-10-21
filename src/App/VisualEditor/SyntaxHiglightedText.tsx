import { RangeWithAnnotation } from "@/languages/statecharts/transitionlabel/syntax_higlight";
import { memo, PropsWithChildren } from "react";
import { Tooltip } from "../Components/Tooltip";

// This React component is used to render all syntax-highlighted text in StateBuddy.
// That means:
//   - <text> in SVG (wrapped in <tspan>) in the visual editor
//   - <textarea> (wrapped in <span>) when editing text labels
// To make syntax highlighting happen, portions of text are wrapped in <span> or <tspan> with CSS properties added for color, etc.
// Important precondition: ranges are non-overlapping!
export const SyntaxHighlightedText = memo(function SyntaxHighlightedText({text, ranges, tspan, disableTooltips}: { text: string; ranges: RangeWithAnnotation[]; tspan?: boolean, disableTooltips?: boolean}) {
  let prevEnd = 0;
  const Span = tspan ? TSpanWrapper : SpanWrapper;
  return <>
    {[
      ...ranges,
      {start: text.length, end: text.length, tooltip: undefined, style: {}},
    ].map(({ start, end, tooltip, style }, i) => {
      // piece of unstyled text
      const unstyledText = text.slice(prevEnd, start);
      const unstyledSlice = trimWhitespace(unstyledText);
      // piece of styled text
      const styledText = text.slice(start, end);
      const styledSlice = trimWhitespace(styledText);

      if (unstyledSlice.trimmedText === "") {
        unstyledSlice.trailing = seqTrim(unstyledSlice.leading, unstyledSlice.trailing);
      }

      const styledPiece = <Span style={style}>
        {tspan ? <TSpanWithLineBreaks text={styledSlice.trimmedText} whatWasTrimmed={seqTrim(unstyledSlice.trailing, styledSlice.leading)}/> : <>{styledText}</>}
      </Span>;
      const result = <Span key={`${i}-${start}-${end}`}>
        {/* the part of the text before the current text range. this will be rendered without any CSS style */}
        {(unstyledSlice.trimmedText.length !== 0 || !tspan) &&
          <Span>
            {tspan ? <TSpanWithLineBreaks text={unstyledSlice.trimmedText} whatWasTrimmed={unstyledSlice.leading}/> : <>{unstyledText}</>}
          </Span>}
        {/* the current text range, to be rendered with special CSS style */}
        {disableTooltips ? styledPiece
          : <Tooltip tooltip={tooltip} showWhen="always" error>
              {styledPiece}
            </Tooltip>}
      </Span>;
      prevEnd = end;
      return result;
    })}
  </>;
});

// workaround for the fact that Chrome doesn't render line breaks in SVG even with {whitespace: preserve}
export function TSpanWithLineBreaks({text, whatWasTrimmed}: {text: string, whatWasTrimmed: WhatWasTrimmed}) {
  const pieces = text.split('\n');
  return pieces.map((piece, i) => {
    if (i === 0) {
      const pos = positionOfTrimmedText(whatWasTrimmed);
      return <tspan key={i} {...pos}>
        {piece}
      </tspan>;
    }
    else {
      return <tspan key={i} x={0} dy='1.5em'>{piece}</tspan>;
    }
  });
}

function SpanWrapper({children, ...rest}: PropsWithChildren<React.HTMLAttributes<HTMLSpanElement>>) {
  return <span {...rest}>{children}</span>;
}

function TSpanWrapper({children, ...rest}: PropsWithChildren<React.SVGProps<SVGTSpanElement>>) {
  return <tspan {...rest}>{children}</tspan>;
}


// Imagine the following piece of text:
//
//   --
//   ---
//   --XX-XXX---
//   
//   ----
//
// where - = space and X = visible character
//
// When rendering this as SVG text, browsers will trim this to:
//
//   XX-XXX
//
// We want to render all whitespace as-is, so it is our job to emulate the whitespace back in by moving the text to the right position.
//
// In this example, we will shift the text:
//   - vertically by 2 character-heights because there are 2 newlines before the visible text.
//   - horizontally all the way to the left (absolute value) (because there is at least one newline) + 2 character-widths because there are 2 spaces on the line of the visible text before the visible text starts.
// Further, if any text follows this piece of text, that text also needs to be shifted:
//   - horizontally all the way to the left (absolute value) (because there is at least one newline) + 4 character-widths for the spaces at the very last line
//   - vertically by 2 character-heights because there are 3 newlines.
//
// So the information we need about a piece of text is:
type TrimmedText = {
  leading: WhatWasTrimmed,
  trimmedText: string, // the trimmed text
  trailing: WhatWasTrimmed,
};

type TrimmedTextPosition = {
  x: undefined | string,
  dx: undefined | string,
  dy: undefined | string,
}

type WhatWasTrimmed = {
  newlines: number,
  spaces: number,
}

function seqTrim(a: WhatWasTrimmed, b: WhatWasTrimmed): WhatWasTrimmed {
  return {
    newlines: a.newlines + b.newlines,
    spaces: (b.newlines === 0 ? a.spaces : 0) + b.spaces,
  }
}

function positionOfTrimmedText({newlines, spaces}: WhatWasTrimmed): TrimmedTextPosition {
  return {
    x: newlines > 0 ? '0' : undefined,
    dx: `${spaces}ch`,
    dy: `${1.5*newlines}em`,
  };
}

function trimWhitespace(text: string): TrimmedText {  
  const [_, leading, trimmedText, trailing] = text.match(/^(\s*)([\s\S]*?)(\s*)$/) as [any, string, string, string];

  return {
    leading: whatWasTrimmed(leading),
    trimmedText,
    trailing: whatWasTrimmed(trailing),
  }
}

function whatWasTrimmed(text: string): WhatWasTrimmed {
  let newlines = 0;
  let spaces = 0;
  for (const char of text) {
    if (char === '\n') {
      spaces = 0;
      newlines++;
    }
    else if (char === ' ') {
      spaces++;
    }
  }
  return {newlines, spaces};
}
