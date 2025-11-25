import { decodeCell, getCells } from "@/statecharts/detect_connections";
import { Rect2D } from "@/util/geometry";
import { GRID_CELL_SIZE } from "../parameters";
import { useContext } from "react";
import { DebugContext } from "./context/DebugContext";

export function BoundingBox(bbox: Rect2D) {
  const cells = [...getCells(bbox)];
  const debugContext = useContext(DebugContext);
  return <>
    {debugContext.showBBox && <rect
      x={bbox.topLeft.x}
      y={bbox.topLeft.y}
      width={bbox.size.x}
      height={bbox.size.y}
      stroke="magenta"
      strokeWidth={.5}
      fill="none"
      style={{pointerEvents:'none'}}
    />}
    {debugContext.showCells && cells.map(cell =>
      <rect
        {...decodeCell(cell)}
        width={GRID_CELL_SIZE}
        height={GRID_CELL_SIZE}
        fill="rgba(0, 255, 191, 0.2)"
        style={{pointerEvents:'none'}}
      />
    )}
  </>
}
