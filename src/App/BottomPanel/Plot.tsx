import plotStyles from "./Plot.module.css";
import { SVGAttributes, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Setters } from "../makePartialSetter";
import { PreparedTraces } from "../SideBar/prepare_trace";
import { Tooltip } from "../Components/Tooltip";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

export type PlotState = {
  visiblePlots: {[name: string]: boolean},
}

export const defaultPlotState = {
  visiblePlots: {},
}

type PlotProperties = PlotState & Setters<PlotState> & SVGAttributes<SVGElement> & {
  traces: PreparedTraces,
  displayTime: number,
  endOfTime: number,
  nextWakeup: number, // nextEventTime is the furthest we can confidently extend the signal plots into the future.
}

const numColors = 6; // corresponds to CSS variables --plot-color-N in index.css

export function Plot({traces, displayTime, endOfTime, nextWakeup, visiblePlots, setVisiblePlots, ...rest}: PlotProperties) {
  const refSVG = useRef(null);
  const [width, setWidth] = useState<number>(window.innerWidth);

  const atLeastOnePlot = Object.entries(visiblePlots).some(([key, val]) => val === true && Object.hasOwn(traces, key));
  const traceNames = useMemo(() => Object.keys(traces).filter(name => !["true", "false"].includes(name)), [traces]);

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

  const numVisible = Object.entries(visiblePlots).reduce((n, [name, visible]) => (visible && Object.hasOwn(traces, name)) ? n + 1 : n, 0);
  const height = 20*numVisible;

  traces = Object.fromEntries(Object.entries(traces).filter(([name]) => !["true", "false"].includes(name)))

  const maxTime = Math.max(endOfTime, 1);
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
    const lastX = Math.min(nextWakeup, endOfTime); // if nextWakeup is Infinity, draw the line to the end instead (we cannot draw a line to infinity)
    path += ` L${toSVGcoords(lastX)},${prevY}`;
    return path;
  }

  const currentTimeSvgX = toSVGcoords(displayTime);

  const markerEveryXMs = Math.max(250*2**Math.ceil(Math.log2(endOfTime/1000/30/width*2000)), 250);
  const labelEveryXMarkers = 2;

  const marks = [];
  for (let i=0; i<endOfTime; i+=markerEveryXMs) {
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
        return <path d={renderSignal(name, i++)} className={plotStyles.plotLine} style={{stroke: color}} />;
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
      return <>
        {(prevPrefix && ((prevPrefix === curPrefix)
          && <br/>
          || <div style={{breakAfter: 'column'}}></div>))}
          {/*             ^ doesn't yet work in Firefox :( */}
        <label key={name} htmlFor={`checkbox-trace-${name}`} style={{breakInside: 'avoid'}}>
          <input type="checkbox" id={`checkbox-trace-${name}`} checked={visiblePlots[name]} onChange={e => setVisiblePlots(visible => ({...visible, [name]: e.target.checked}))} style={{accentColor: color}}/>
          <span style={{color}}>{name}</span>
        </label>
      </>;
    });
  })();

  return <>
    {atLeastOnePlot &&
      <svg style={{height: height+18}} ref={refSVG} viewBox={`0 0 ${width} ${height+18}`} {...rest}>
        <line x1={currentTimeSvgX} x2={currentTimeSvgX} y1={0} y2={height+4} stroke="grey" strokeWidth={6} />
        {xAxis}
        {paths}
      </svg>}
      <div style={{
        columnWidth: 220,
      }}>
      {checkboxes}
    </div>
  </>;
}
