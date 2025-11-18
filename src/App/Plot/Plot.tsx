import "./Plot.css";
import { SVGAttributes, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Setters } from "../makePartialSetter";
import { PreparedTraces } from "../SideBar/check_property";

export type PlotState = {
  visiblePlots: {[name: string]: boolean},
}

export const defaultPlotState = {
  visiblePlots: {},
}

type PlotProperties = PlotState & Setters<PlotState> & SVGAttributes<SVGElement> & {
  traces: PreparedTraces,
  displayTime: number,
  nextWakeup: number, // nextEventTime is the furthest we can confidently extend the signal plots into the future.
}

const numColors = 6; // corresponds to CSS variables --plot-color-N in index.css

export function Plot({traces, displayTime, nextWakeup, visiblePlots, setVisiblePlots, ...rest}: PlotProperties) {
  const refSVG = useRef(null);
  const [width, setWidth] = useState<number>(window.innerWidth);

  const traceNames = useMemo(() => Object.keys(traces).filter(name => !["true", "false"].includes(name)), [traces]);

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

  function renderSignal(name: string, i: number) {
    let path = "";
    let prevY;
    for (const [time, value] of traces[name]) {
      const x = toSVGcoords(time);
      const y = (value ? margin : (yDiff-margin)) + yDiff*(i);
      if (prevY) {
        path += ` L${x},${prevY}`;
      }
      else {
        path += `M${x},${y}`
      }
      path += ` L${x},${y}`;
      prevY = y;
    }
    // extend signal to next wakeup (this is reasonable)
    const lastX = Math.min(nextWakeup, displayTime); // if nextWakeup is Infinity, draw the line to the end instead (we cannot draw a line to infinity)
    path += ` L${toSVGcoords(lastX)},${prevY}`;
    return path;
  }

  const markerEveryXMs = Math.max(250*2**Math.ceil(Math.log2(displayTime/1000/30/width*2000)), 250);
  const labelEveryXMarkers = 2;

  const marks = [];
  for (let i=0; i<displayTime; i+=markerEveryXMs) {
    marks.push(i);
  }

  const xAxis = marks.map((m,i) => {
    const x = i*(markerEveryXMs)/maxTime*width;
    return <>
      <line x1={x} x2={x} y1={0} y2={height+2} stroke="var(--separator-color)"/>
      {i%labelEveryXMarkers===0 &&
        <text x={x} y={height+16} textAnchor="middle" style={{fill: 'var(--text-color)'}}>{m/1000}</text>
      }
      </>;
  });

  const paths = (() => {
    let i=0;
    return traceNames.map(name => {
      if (visiblePlots[name]) {
        const color = `var(--plot-color-${i%numColors})`;
        return <path d={renderSignal(name, i++)} className="plotLine" style={{stroke: color}} />;
      }
      else {
        return <></>;
      }
    });
  })();

  const checkboxes = (() => {
    let i=0;
    return traceNames.map(name => {
      const color = visiblePlots[name]
        ? `var(--plot-color-${i++%numColors})`
        : 'var(--text-color)';
      return <label key={name} htmlFor={`checkbox-trace-${name}`}>
        <input type="checkbox" id={`checkbox-trace-${name}`} checked={visiblePlots[name]} onChange={e => setVisiblePlots(visible => ({...visible, [name]: e.target.checked}))} style={{accentColor: color}}/>
        <span style={{color}}>{name}</span>
      </label>;
    });
  })();

  return <>
    <svg style={{height: height+18}} ref={refSVG} viewBox={`0 0 ${width} ${height+18}`} {...rest}>
      {xAxis}
      {paths}
    </svg>
    <div>
      {checkboxes}
    </div>
  </>;
}
