import { useResizeable } from "@/hooks/useResizeable";
import { Dispatch, SetStateAction } from "react";

export function ResizeHandle({setSize, getDelta, horizontal}: {
  setSize: Dispatch<SetStateAction<number>>,
  getDelta: (e: MouseEvent) => number,
  horizontal?: boolean
}) {
  const [resizing, beginResize] = useResizeable(e => setSize(width => width + getDelta(e)));

  return <div style={{
      flex: '0 0 content',
    }}>
    <div
      style={{
        height: horizontal ? 2: '100%',
        width: horizontal ? '100%' : 2,
        backgroundColor: resizing ? 'var(--tooltip-bg-color)' : 'var(--separator-color)',
        cursor: horizontal ? 'row-resize' : 'col-resize',
      }}
      onMouseDown={beginResize}
    />
  </div>;
}
