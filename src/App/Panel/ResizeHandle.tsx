import { useResizeable } from "@/hooks/useResizeable";
import { Dispatch, SetStateAction, useCallback } from "react";

const thickness = 3;

export function ResizeHandle({setSize, getDelta, horizontal, minSize, maxSize}: {
  setSize: Dispatch<SetStateAction<number>>,
  getDelta: (e: MouseEvent) => number,
  horizontal?: boolean,
  minSize?: number,
  maxSize?: number,
}) {
  const cb = useCallback(
    (e: MouseEvent) => setSize(oldSize => {
      let newSize = Math.max(minSize || 0, oldSize + getDelta(e));
      if (maxSize) newSize = Math.min(maxSize, newSize);
      return newSize;
    }),
    [getDelta, setSize, minSize, maxSize]);

  const [resizing, beginResize] = useResizeable(cb);

  return <div style={{
      flex: '0 0 content',
    }}>
    <div
      style={{
        height: horizontal ? thickness : '100%',
        width: horizontal ? '100%' : thickness,
        backgroundColor: resizing ? 'var(--tooltip-bg-color)' : 'var(--separator-color)',
        cursor: horizontal ? 'row-resize' : 'col-resize',
      }}
      onMouseDown={beginResize}
    />
  </div>;
}
