import { Rect2D, Vec2D, Line2D, euclideanDistance, intersectLines, isWithin, lineBBox } from "../VisualEditor/geometry";
import { ARROW_SNAP_THRESHOLD, TEXT_SNAP_THRESHOLD } from "../VisualEditor/parameters";
import {  sides } from "../VisualEditor/VisualEditor";

export type Rountangle = {
  uid: string;
  kind: "and" | "or" | "pseudo";
} & Rect2D;

export type Text = {
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

// used to find which rountangle an arrow connects to (src/tgt)
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

export function point2LineDistance(point: Vec2D, {start, end}: Line2D): number {
  const A = point.x - start.x;
  const B = point.y - start.y;
  const C = end.x - start.x;
  const D = end.y - start.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let t = lenSq ? dot / lenSq : -1;

  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  const closestX = start.x + t * C;
  const closestY = start.y + t * D;

  const dx = point.x - closestX;
  const dy = point.y - closestY;

  const distance = Math.hypot(dx, dy);
  
  return distance;
}

// used to find which arrow a text label belongs to (if any)
//  author: ChatGPT
export function findNearestArrow(point: Vec2D, candidates: Arrow[]): Arrow | undefined {
  let best;
  let bestDistance = Infinity

  for (const arrow of candidates) {
    const distance = point2LineDistance(point, arrow);

    if (distance < TEXT_SNAP_THRESHOLD && distance < bestDistance) {
      bestDistance = distance;
      best = arrow;
    }
  }

  return best;
}

// precondition: candidates are sorted from big to small
export function findRountangle(point: Vec2D, candidates: Rountangle[]): Rountangle | undefined {
  for (let i=candidates.length-1; i>=0; i--) {
    if (isWithin(point, candidates[i])) {
      return candidates[i];
    }
  }
}
