import { normalizeRect, Rect2D } from "@/util/geometry";
import styles from "./VisualEditor.module.css";
import { Selection } from "./VisualEditor.state";

export type SelectingState = Rect2D | undefined;

export function Selecting(props: SelectingState) {
  const normalizedRect = normalizeRect(props!);
  return <rect
    className={styles.selecting}
    x={normalizedRect.topLeft.x}
    y={normalizedRect.topLeft.y}
    width={normalizedRect.size.x}
    height={normalizedRect.size.y}
  />;
}
export function mergeSelections(a: Selection, b: Selection) {
  const result = new Map(a);
  for (const [uid, parts] of b.entries()) {
    result.set(uid, (result.get(uid) || new Set()).union(parts));
  }
  return result;
}
