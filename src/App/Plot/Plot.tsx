import { usePersistentState } from "@/hooks/usePersistentState";
import "./Plot.css";
import { SVGAttributes, useEffect, useLayoutEffect, useRef, useState } from "react";

export function Plot({traces, displayTime, ...rest}: {traces: {[name: string]: [number, boolean][]}, displayTime: number} & SVGAttributes<SVGElement>) {
  const refSVG = useRef(null);
  const [width, setWidth] = useState<null|number>(null);

  const [visible, setVisible] = usePersistentState<{[name: string]: boolean}>("visibleSignals", {});

  const numVisible = Object.values(visible).reduce((n, item) => item ? n + 1 : n, 0);
  const height = 20*numVisible;

  traces = Object.fromEntries(Object.entries(traces).filter(([name]) => !["true", "false"].includes(name)))

  useLayoutEffect(() => {
    if (refSVG.current) {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          console.log(entry);
          setWidth(entry.contentRect.width);
        }
      });
      observer.observe(refSVG.current);
    }    
  }, [refSVG.current])

  if (width === null) {
    return <svg ref={refSVG} {...rest}></svg>;
  }

  const maxTime = displayTime;

  const margin = 2;
  const yDiff = height / (numVisible);

  const paths: {[name: string]: string} = {};
  let i=0;
  for (const [name, trace] of Object.entries(traces)) {
    if (visible[name]) {
      const y = ((yDiff-margin)) + yDiff*(i);
      let path = `M0,${y}`;
      let prevY;
      for (const [time, value] of trace) {
        const x = time / maxTime * width;
        const y = (value ? margin : (yDiff-margin)) + yDiff*(i);
        if (prevY) {
          path += ` L${x},${prevY}`;
        }
        path += ` L${x},${y}`;
        prevY = y;
      }
      path += ` L${width},${prevY}`;
      paths[name] = path;
      i++;
    }
  }

  const colors = [
    "var(--plot-color-0)",
    "var(--plot-color-1)",
    "var(--plot-color-2)",
    "var(--plot-color-3)",
    "var(--plot-color-4)",
    "var(--plot-color-5)",
  ];

  const markerEveryXMs = Math.max(250*2**Math.ceil(Math.log2(displayTime/1000/30/width*2000)), 250);
  const labelEveryXMarkers = 2;

  const marks = [];
  for (let i=0; i<displayTime; i+=markerEveryXMs) {
    marks.push(i);
  }

  return <div className="statusBar">
    <details>
      <summary>plot</summary>
      <svg style={{height: height+18}} ref={refSVG} viewBox={`0 0 ${width} ${height+18}`} {...rest}>
        {marks.map((m,i) => {
          const x = i*(markerEveryXMs)/maxTime*width;
          return <>
            <line x1={x} x2={x} y1={0} y2={height+2 } stroke="var(--separator-color)"/>
            {i%labelEveryXMarkers===0 &&
              <text x={x} y={height+16} textAnchor="middle" style={{fill: 'var(--text-color)'}}>{m/1000}</text>
            }
            </>;
        })}
        {Object.entries(paths).map(([name], i) => {
          if (visible[name]) {
            return <path d={paths[name]} className="plotLine" style={{stroke: colors[i%colors.length]}} />;
          }
          else {
            return <></>;
          }
        })}
      </svg>
      <div>
        {(() => {
          let i=0;
          return Object.entries(traces).map(([name]) => 
            <label key={name} htmlFor={`checkbox-trace-${name}`}>
              <input type="checkbox" id={`checkbox-trace-${name}`} checked={visible[name]} onChange={e => setVisible(visible => ({...visible, [name]: e.target.checked}))}/>
              <span style={{color: visible[name] ? colors[(i++)%colors.length] : 'var(--text-color)'}}>{name}</span>
            </label>
        )})()}
      </div>
    </details>
  </div>;
}
