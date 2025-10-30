import { normalizeRect, Rect2D } from "@/util/geometry";

export type SelectingState = Rect2D | null;

export function Selecting(props: SelectingState) {
  const normalizedRect = normalizeRect(props!);
  return <rect
    className="selecting"
    x={normalizedRect.topLeft.x}
    y={normalizedRect.topLeft.y}
    width={normalizedRect.size.x}
    height={normalizedRect.size.y}
  />;
}