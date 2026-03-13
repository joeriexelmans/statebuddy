import plotStyles from "./Plot.module.css";
import { memo, SVGAttributes, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WithSetters } from "../makePartialSetter";
import { PreparedTraces, PropertyCheckResult } from "../SideBar/prepare_trace";
import { objectsEqual } from "@/util/util";
import { StateBuddyTraceState } from "../hooks/useSimulator";

// Part of application state.
export type PlotState = {
  visiblePlots: {[name: string]: boolean},
}

export const defaultPlotState = {
  visiblePlots: {},
}

type PlotProperties = SVGAttributes<SVGElement> & WithSetters<{
  state: PlotState
}> & {
  // Traces to plot.
  prepped: PreparedTraces,
  trace: StateBuddyTraceState,
  displayTime: number,
}

const numColors = 6; // corresponds to CSS variables --plot-color-N in index.css

export const Plot = memo(function Plot({state, setState, prepped, trace, displayTime, ...rest}: PlotProperties) {
  const {visiblePlots} = state;
  const refSVG = useRef(null);
  const [width, setWidth] = useState<number>(window.innerWidth);

  // the furthest point on the x-axis
  const endOfTime = Math.max(trace?.trace.at(-1)!.simtime, displayTime, 1);

  const lastWakeup = endOfTime;

  const currentItemSimTime = trace.trace[trace.idx].simtime;

  const atLeastOnePlot = Object.entries(visiblePlots).some(([key, val]) => val === true && Object.hasOwn(prepped, key));
  const traceNames = useMemo(() => Object.keys(prepped).filter(name => !["true", "false"].includes(name)), [prepped]);

  useLayoutEffect(() => {
    if (refSVG.current) {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
      observer.observe(refSVG.current);
    }    
  }, [refSVG.current]);

  const numVisible = Object.entries(visiblePlots).reduce((n, [name, visible]) => (visible && Object.hasOwn(prepped, name)) ? n + 1 : n, 0);
  const height = 20*numVisible;

  prepped = Object.fromEntries(Object.entries(prepped).filter(([name]) => !["true", "false"].includes(name)))

  const maxTime = Math.max(endOfTime, 1); // <-- prevent division by zero :-)
  const margin = 2; // if 0, the lines would overlap
  const yDiff = height / (numVisible);

  function toSVGcoords(simtime: number) {
    return simtime / maxTime * width;
  }

  function renderSignal(name: string, i: number) {
    let path = "";
    let prevY;
    for (const [time, value] of prepped[name]) {
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
    const lastX = Math.min(lastWakeup, endOfTime); // if nextWakeup is Infinity, draw the line to the end instead (we cannot draw a line to infinity)
    path += ` L${toSVGcoords(lastX)},${prevY}`;
    return path;
  }

  const currentTimeSvgX = toSVGcoords(currentItemSimTime);

  const markerEveryXMs = Math.max(250*2**Math.ceil(Math.log2(endOfTime/1000/30/width*2000)), 250);
  const labelEveryXMarkers = 2;

  const marks = [];
  for (let i=0; i<endOfTime; i+=markerEveryXMs) {
    marks.push(i);
  }

  const xAxis = marks.map((m,i) => {
    const x = i*(markerEveryXMs)/maxTime*width;
    return <g key={m}>
      <line x1={x} x2={x} y1={0} y2={height+2} stroke="var(--separator-color)"/>
      {i%labelEveryXMarkers===0 &&
        <text x={x} y={height+16} textAnchor="middle" style={{fill: 'var(--text-color)'}}>{m/1000}</text>
      }
      </g>;
  });

  const paths = (() => {
    let i=0;
    return traceNames.map(name => {
      if (visiblePlots[name]) {
        const color = `var(--plot-color-${i%numColors})`;
        return <path key={name} d={renderSignal(name, i++)} className={plotStyles.plotLine} style={{stroke: color}} />;
      }
      else {
        return <></>;
      }
    });
  })();

  const checkboxes = (() => {
    let i=0;
    return traceNames.map((name, j) => {
      const color = visiblePlots[name]
        ? `var(--plot-color-${i++%numColors})`
        : 'var(--text-color)';
      const prevPrefix = traceNames[j-1]?.split('_')[0];
      const curPrefix = name.split('_')[0];
      return <span key={name}>
        {(prevPrefix && ((prevPrefix === curPrefix)
          && <br/>
          || <div style={{breakAfter: 'column'}}></div>))}
          {/*             ^ doesn't yet work in Firefox :( */}
        <label key={name} htmlFor={`checkbox-trace-${name}`} style={{breakInside: 'avoid'}}>
          <input type="checkbox" id={`checkbox-trace-${name}`} checked={visiblePlots[name]} onChange={e =>
            setState(({visiblePlots}) => ({
              visiblePlots: {
                ...visiblePlots,
                [name]: e.target.checked,
              },
            }))}
            style={{accentColor: color}}/>
          <span style={{color}}>{name}</span>
        </label>
      </span>;
    });
  })();

  return <>
    {atLeastOnePlot &&
      <svg style={{height: height+18, backgroundColor: 'var(--background-color)'}} ref={refSVG} viewBox={`0 0 ${width} ${height+18}`} {...rest}>
        {xAxis}
        <rect x={currentTimeSvgX-2} width={4} y={0} height={height} fill="var(--accent-border-color)" />
        {paths}
      </svg>}
      <div style={{
        columnWidth: 220,
      }}>
      {checkboxes}
    </div>
  </>;
}, objectsEqual);
