import { Rect2D, Vec2D, Line2D, euclideanDistance, intersectLines, isWithin, lineBBox } from "./geometry";
import { ARROW_SNAP_THRESHOLD } from "./parameters";
import {  sides } from "./VisualEditor";

export type Rountangle = {
  uid: string;
  kind: "and" | "or";
} & Rect2D;

type Text = {
  uid: string;
  topLeft: Vec2D;
  text: string;
};

export type Arrow = {
  uid: string;
} & Line2D;

export type VisualEditorState = {
  rountangles: Rountangle[];
  texts: Text[];
  arrows: Arrow[];
  nextID: number;
};

// independently moveable parts of our shapes:
export type RountanglePart = "left" | "top" | "right" | "bottom";
export type ArrowPart = "start" | "end";

export const emptyState = {
  rountangles: [], texts: [], arrows: [], nextID: 0,
};

export const onOffStateMachine = {
  rountangles: [
    { uid: "0", topLeft: { x: 100, y: 100 }, size: { x: 100, y: 100 }, kind: "and" },
    { uid: "1", topLeft: { x: 100, y: 300 }, size: { x: 100, y: 100 }, kind: "and" },
  ],
  texts: [],
  arrows: [
    { uid: "2", start: { x: 150, y: 200 }, end: { x: 160, y: 300 } },
  ],
  nextID: 3,
};

export function findNearestRountangleSide(arrow: Line2D, arrowPart: "start" | "end", candidates: Rountangle[]): {uid: string, part: RountanglePart} | undefined {
  let best = Infinity;
  let bestSide: undefined | {uid: string, part: RountanglePart};
  for (const rountangle of candidates) {
    for (const [side, getSide] of sides) {
      const asLine = getSide(rountangle);
      const intersection = intersectLines(arrow, asLine);
      if (intersection !== null) {
        const bbox = lineBBox(asLine, ARROW_SNAP_THRESHOLD);
        const dist = euclideanDistance(arrow[arrowPart], intersection);
        if (isWithin(arrow[arrowPart], bbox) && dist < best) {
          best = dist;
          bestSide = { uid: rountangle.uid, part: side };
        }
      }
    }
  }
  return bestSide;
}
