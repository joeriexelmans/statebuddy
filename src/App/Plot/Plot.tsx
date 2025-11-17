import "./Plot.css";
import { SVGAttributes, useEffect, useLayoutEffect, useRef, useState } from "react";

export function Plot({traces, displayTime, ...rest}: {traces: {[name: string]: [number, boolean][]}, displayTime: number} & SVGAttributes<SVGElement>) {
  const refSVG = useRef(null);
  const [width, setWidth] = useState<null|number>(null);

  const [visible, setVisible] = useState<{[name: string]: boolean}>({});

  const numVisible = Object.values(visible).reduce((n, item) => item ? n + 1 : n, 0);
  console.log({numVisible});

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
      let path = "M0,0";
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

  const colors = ["blue", "green", "red", "darkorange", "brown", "magenta"];

  return <div className="statusBar">
    <details>
      <summary>plot</summary>
      <svg style={{height}} ref={refSVG} viewBox={`0 0 ${width} ${height}`} {...rest}>
        {Object.entries(traces).map(([name], i) => {
          if (visible[name]) {
            return <path d={paths[name]} className="plotLine" style={{stroke: colors[i%colors.length]}} />;
          }
          else {
            return <></>;
          }
        })}
      </svg>
      <div>
        {Object.entries(traces).map(([name], i) =>
          <label key={name} htmlFor={`checkbox-trace-${name}`}>
            <input type="checkbox" id={`checkbox-trace-${name}`} checked={visible[name]} onChange={e => setVisible(visible => ({...visible, [name]: e.target.checked}))}/>
            <span style={{color: colors[i%colors.length]}}>{name}</span>
          </label>
        )}
      </div>
    </details>
  </div>;
}
