import { RangeWithAnnotation } from "@/statecharts/syntax_higlight";
import { PropsWithChildren } from "react";
import { Tooltip } from "../Components/Tooltip";

export function SyntaxHighlightedText({text, ranges,  tspan, disableTooltips}: { text: string; ranges: RangeWithAnnotation[]; tspan?: boolean, disableTooltips?: boolean}) {
  let prevEnd = 0;
  console.log({ranges});
  const Span = tspan ? TSpanWrapper : SpanWrapper;
  const TT = disableTooltips ? Span : Tooltip;
  return <>
    {[
      ...ranges,
      {start: text.length, end: text.length, tooltip: undefined, style: {}},
    ].map(({ start, end, tooltip, style }, i) => {
      const result = <Span key={`${i}-${start}-${end}`}>
        {/* the part of the text before the current text range */}
        <Span>
          {text.slice(prevEnd, start)}
        </Span>
        {/* the current text range */}
        <TT tooltip={tooltip} showWhen="always" error>
          <Span style={style}>
            {text.slice(start, end)}
          </Span>
        </TT>
      </Span>;
      prevEnd = end;
      return result;
    })}
  </>;
}

function SpanWrapper({children, ...rest}: PropsWithChildren<React.HTMLAttributes<HTMLSpanElement>>) {
  return <span {...rest}>{children}</span>;
}

function TSpanWrapper({children, ...rest}: PropsWithChildren<React.SVGProps<SVGTSpanElement>>) {
  return <tspan {...rest}>{children}</tspan>;
}
