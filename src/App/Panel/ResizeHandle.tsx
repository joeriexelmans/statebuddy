import { useResizeable } from "@/hooks/useResizeable";
import { Dispatch, SetStateAction, useCallback } from "react";
import styles from "../App.module.css";

const thickness = 4;

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
      className={styles.resizeHandle}
      style={{
        height: horizontal ? thickness : '100%',
        width: horizontal ? '100%' : thickness,
        backgroundColor: resizing ? 'var(--accent-border-color)' : undefined,
        cursor: horizontal ? 'row-resize' : 'col-resize',
      }}
      onMouseDown={beginResize}
    />
  </div>;
}
