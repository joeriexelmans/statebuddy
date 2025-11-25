import { Rect2D, Vec2D, Line2D, euclideanDistance, intersectLines, isWithin, lineBBox, subtractV2D, roundRect2D, roundVec2D, roundLine2D, addV2D, scaleV2D } from "../util/geometry";
import { ARROW_SNAP_THRESHOLD, HISTORY_RADIUS, ROUNTANGLE_RADIUS, TEXT_SNAP_THRESHOLD } from "../App/parameters";
import {  VisualEditorState } from "../App/VisualEditor/VisualEditor";
import { sides } from "@/util/geometry";

export type Rountangle = {
  uid: string;
  kind: "and" | "or";
} & Rect2D;

export type Diamond = {
  uid: string;
} & Rect2D;

export type Text = {
  uid: string;
  topLeft: Vec2D; // <-- actually not the topleft, but the middle of the text. I cannot change this right now because it would break all my existing models :(
  text: string;
};

export type Arrow = {
  uid: string;
} & Line2D;

export type History = {
  uid: string;
  kind: "shallow" | "deep";
  topLeft: Vec2D;
};

export type ConcreteSyntax = {
  rountangles: Rountangle[];
  texts: Text[];
  arrows: Arrow[];
  diamonds: Diamond[];
  history: History[];
};

export function roundCS(cs: ConcreteSyntax): ConcreteSyntax {
  return {
    rountangles: cs.rountangles.map(r => ({...r, ...roundRect2D(r)})),
    texts: cs.texts.map(t => ({...t, topLeft: roundVec2D(t.topLeft)})),
    arrows: cs.arrows.map(a => ({...a, ...roundLine2D(a)})),
    diamonds: cs.diamonds.map(d => ({...d, ...roundRect2D(d)})),
    history: cs.history.map(h => ({...h, topLeft: roundVec2D(h.topLeft)})),
  };
}

// independently moveable parts of our shapes:
export type RectSide = "left" | "top" | "right" | "bottom";
export type ArrowPart = "start" | "end";

export const initialEditorState: VisualEditorState = {
  rountangles: [{
    uid:"0",
    topLeft:{x:76.25,y:122.5},
    size:{x:133.75,y:103.75},
    kind:"and"
  }],
  diamonds:[],
  history:[],
  arrows:[{
    uid:"39",
    start:{x:85,y:67.5},
    end:{x:116.25,y:116.25}
  }],
  texts:[],
  nextID: 1,
  selection: [],
};

// used to find which rountangle an arrow connects to (src/tgt)
export function findNearestSide(arrow: Line2D, arrowPart: "start" | "end", candidates: Iterable<(Rountangle|Diamond)>): {uid: string, part: RectSide} | undefined {
  let best = Infinity;
  let bestSide: undefined | {uid: string, part: RectSide};
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
export function findNearestArrow(point: Vec2D, candidates: Iterable<Arrow>): Arrow | undefined {
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

export function findNearestHistory(point: Vec2D, candidates: History[]): History | undefined {
  let best;
  let bestDistance = Infinity;
  for (const h of candidates) {
    const diff = subtractV2D(point, {x: h.topLeft.x+HISTORY_RADIUS, y: h.topLeft.y+HISTORY_RADIUS});
    const euclideanDistance = Math.hypot(diff.x, diff.y) - HISTORY_RADIUS;
    if (euclideanDistance < ARROW_SNAP_THRESHOLD) {
      if (euclideanDistance < bestDistance) {
        best = h;
        bestDistance = euclideanDistance;
      }
    }
  }
  return best;
}

export function rountangleMinSize(size: Vec2D): Vec2D {
  const minSize = ROUNTANGLE_RADIUS * 2;
  if (size.x >= minSize && size.y >= minSize) {
    return size;
  }
  return {
    x: Math.max(minSize, size.x),
    y: Math.max(minSize, size.y),
  };
};

const maxSnapDistance = Math.ceil(Math.max(ARROW_SNAP_THRESHOLD, TEXT_SNAP_THRESHOLD)/2);
const snap = {x: -maxSnapDistance, y: -maxSnapDistance};
const snapTwice = scaleV2D(snap, -2);

// for rountangles and diamonds
export function getRectFatBBox(r: Rect2D): Rect2D {
  return r;
}

const arrowBBoxSize = {
  x: maxSnapDistance*2,
  y: maxSnapDistance*2,
};

export function getArrowFatBBox(a: Arrow): Rect2D {
  return {
    topLeft: {
      x: Math.min(a.start.x, a.end.x) - maxSnapDistance,
      y: Math.min(a.start.y, a.end.y) - maxSnapDistance,
    },
    size: {
      x: Math.abs(a.start.x - a.end.x) + maxSnapDistance*2,
      y: Math.abs(a.start.y - a.end.y) + maxSnapDistance*2,
    },
  };
}

// bboxes of start and end position
export function getArrowFatBBoxes(a: Arrow): [Rect2D, Rect2D] {
  return [{
    topLeft: {
      x: a.start.x - maxSnapDistance,
      y: a.start.y - maxSnapDistance,
    },
    size: arrowBBoxSize,
  }, {
    topLeft: {
      x: a.end.x - maxSnapDistance,
      y: a.end.y - maxSnapDistance,
    },
    size: arrowBBoxSize,
  }];
}

export function getTextFatBBox(t: Text): Rect2D {
  return {
    topLeft: addV2D(t.topLeft, snap),
    size: snapTwice,
  };
}

export function getHistoryFatBBox(h: History): Rect2D {
  return {
    topLeft: addV2D(h.topLeft, snap),
    size: historyBBoxSize,
  };
}

const historyBBoxSize = addV2D({x: HISTORY_RADIUS*2, y: HISTORY_RADIUS*2}, snapTwice);