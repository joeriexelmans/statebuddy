import { RangeWithAnnotation } from "@/statecharts/syntax_higlight";
import { memo, PropsWithChildren } from "react";
import { Tooltip } from "../Components/Tooltip";

export const SyntaxHighlightedText = memo(function SyntaxHighlightedText({text, ranges, tspan, disableTooltips}: { text: string; ranges: RangeWithAnnotation[]; tspan?: boolean, disableTooltips?: boolean}) {
  let prevEnd = 0;
  const Span = tspan ? TSpanWrapper : SpanWrapper;
  return <>
    {[
      ...ranges,
      {start: text.length, end: text.length, tooltip: undefined, style: {}},
    ].map(({ start, end, tooltip, style }, i) => {
      const prevSlice = text.slice(prevEnd, start);
      const slice = text.slice(start, end);
      const rangedPiece = <Span style={style}>
            {tspan ? <TextWithLineBreaks text={slice}/> : <>{slice}</>}
          </Span>;
      const result = <Span key={`${i}-${start}-${end}`}>
        {/* the part of the text before the current text range */}
        <Span>
          {tspan ? <TextWithLineBreaks text={prevSlice}/> : <>{prevSlice}</>}
        </Span>
        {/* the current text range */}
        {disableTooltips ? rangedPiece
          : <Tooltip tooltip={tooltip} showWhen="always" error>
              {rangedPiece}
            </Tooltip>}
      </Span>;
      prevEnd = end;
      return result;
    })}
  </>;
});

// workaround for the fact that Chrome doesn't render line breaks in SVG even with {whitespace: preserve}
export function TextWithLineBreaks({text}: {text: string}) {
  const pieces = text.split('\n');
  return pieces.map((piece, i) =>
    <tspan key={i} x={i>0 ? 0 : undefined} dy={i>0 ? '1.2em' : undefined}>
      {piece}
    </tspan>);
}

function SpanWrapper({children, ...rest}: PropsWithChildren<React.HTMLAttributes<HTMLSpanElement>>) {
  return <span {...rest}>{children}</span>;
}

function TSpanWrapper({children, ...rest}: PropsWithChildren<React.SVGProps<SVGTSpanElement>>) {
  return <tspan {...rest}>{children}</tspan>;
}
