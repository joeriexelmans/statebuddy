import "./Plot.css";
import { SVGAttributes, useLayoutEffect, useRef, useState } from "react";
import { Setters } from "../makePartialSetter";

export type PlotState = {
  visiblePlots: {[name: string]: boolean},
}

export const defaultPlotState = {
  visiblePlots: {},
}

type PlotProperties = PlotState & Setters<PlotState> & SVGAttributes<SVGElement> & {
  traces: {[name: string]: [number, boolean][]},
  displayTime: number,
  nextWakeup: number, // nextEventTime is the furthest we can confidently extend the signal plots into the future.
}

const numColors = 6; // corresponds to CSS variables --plot-color-N in index.css

export function Plot({traces, displayTime, nextWakeup, visiblePlots, setVisiblePlots, ...rest}: PlotProperties) {
  const refSVG = useRef(null);
  const [width, setWidth] = useState<number>(window.innerWidth);

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
  }, [refSVG.current]);

  const numVisible = Object.entries(visiblePlots).reduce((n, [name, visible]) => (visible && Object.hasOwn(traces, name)) ? n + 1 : n, 0);
  const height = 20*numVisible;

  traces = Object.fromEntries(Object.entries(traces).filter(([name]) => !["true", "false"].includes(name)))

  const maxTime = Math.max(displayTime, 1);
  const margin = 2; // if 0, the lines would overlap
  const yDiff = height / (numVisible);

  function toSVGcoords(simtime: number) {
    return simtime / maxTime * width;
  }

  // todo: render incrementally?
  const paths: {[name: string]: string} = {};
  let i=0;
  for (const [name, trace] of Object.entries(traces)) {
    if (visiblePlots[name]) {
      const y = ((yDiff-margin)) + yDiff*(i);
      let path = `M0,${y}`;
      let prevY;
      for (const [time, value] of trace) {
        const x = toSVGcoords(time);
        const y = (value ? margin : (yDiff-margin)) + yDiff*(i);
        if (prevY) {
          path += ` L${x},${prevY}`;
        }
        path += ` L${x},${y}`;
        prevY = y;
      }
      // extend signal to furthest point in simulated time
      path += ` L${toSVGcoords(nextWakeup)},${prevY}`;
      paths[name] = path;
      i++;
    }
  }

  const markerEveryXMs = Math.max(250*2**Math.ceil(Math.log2(displayTime/1000/30/width*2000)), 250);
  const labelEveryXMarkers = 2;

  const marks = [];
  for (let i=0; i<displayTime; i+=markerEveryXMs) {
    marks.push(i);
  }

  return <>
    <svg style={{height: height+18}} ref={refSVG} viewBox={`0 0 ${width} ${height+18}`} {...rest}>
      {marks.map((m,i) => {
        const x = i*(markerEveryXMs)/maxTime*width;
        return <>
          <line x1={x} x2={x} y1={0} y2={height+2} stroke="var(--separator-color)"/>
          {i%labelEveryXMarkers===0 &&
            <text x={x} y={height+16} textAnchor="middle" style={{fill: 'var(--text-color)'}}>{m/1000}</text>
          }
          </>;
      })}
      {Object.entries(paths).map(([name], i) => {
        if (visiblePlots[name]) {
          const color = `var(--plot-color-${i%numColors})`;
          return <path d={paths[name]} className="plotLine" style={{stroke: color}} />;
        }
        else {
          return <></>;
        }
      })}
    </svg>
    <div>
      {(() => {
        let i=0;
        return Object.entries(traces).map(([name]) => {
          const color = visiblePlots[name]
            ? `var(--plot-color-${i%numColors})`
            : 'var(--text-color)';
          i++;
          return <label key={name} htmlFor={`checkbox-trace-${name}`}>
            <input type="checkbox" id={`checkbox-trace-${name}`} checked={visiblePlots[name]} onChange={e => setVisiblePlots(visible => ({...visible, [name]: e.target.checked}))} style={{accentColor: color}}/>
            <span style={{color}}>{name}</span>
          </label>;
      })})()}
    </div>
  </>;
}
