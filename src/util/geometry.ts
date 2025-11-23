import { RectSide } from "../statecharts/concrete_syntax";

export type Vec2D = {
  x: number;
  y: number;
};

export type Rect2D = {
  topLeft: Vec2D;
  size: Vec2D;
};

export type Line2D = {
  start: Vec2D;
  end: Vec2D;
};

// make sure size is always positive
export function normalizeRect(rect: Rect2D) {
  return {
    topLeft: {
      x: rect.size.x < 0 ? (rect.topLeft.x + rect.size.x) : rect.topLeft.x,
      y: rect.size.y < 0 ? (rect.topLeft.y + rect.size.y) : rect.topLeft.y,
    },
    size: {
      x: rect.size.x < 0 ? -rect.size.x : rect.size.x,
      y: rect.size.y < 0 ? -rect.size.y : rect.size.y,
    }
  };
}

export function isEntirelyWithin(child: Rect2D, parent: Rect2D) {
  return (
    child.topLeft.x >= parent.topLeft.x
    && child.topLeft.y >= parent.topLeft.y
    && child.topLeft.x + child.size.x <= parent.topLeft.x + parent.size.x
    && child.topLeft.y + child.size.y <= parent.topLeft.y + parent.size.y
  );
}

export function isWithin(p: Vec2D, r: Rect2D) {
  return (
       p.x >= r.topLeft.x && p.x <= r.topLeft.x + r.size.x
    && p.y >= r.topLeft.y && p.y <= r.topLeft.y + r.size.y
  );
}

export function addV2D(a: Vec2D, b: Vec2D) {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

export function subtractV2D(a: Vec2D, b: Vec2D) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

export function scaleV2D(p: Vec2D, scale: number) {
  return {
    x: p.x * scale,
    y: p.y * scale,
  };
}

export function area(rect: Rect2D) {
  return rect.size.x * rect.size.y;
}

export function lineBBox(line: Line2D, margin=0): Rect2D {
  return {
    topLeft: {
      x: line.start.x - margin,
      y: line.start.y - margin,
    },
    size: {
      x: line.end.x - line.start.x + margin*2,
      y: line.end.y - line.start.y + margin*2,
    },
  }
}

export function transformRect(rect: Rect2D, parts: string[], delta: Vec2D): Rect2D {
  return {
    topLeft: {
      x: parts.includes("left") ? rect.topLeft.x + delta.x : rect.topLeft.x,
      y: parts.includes("top") ? rect.topLeft.y + delta.y : rect.topLeft.y,
    },
    size: {
      x: /*Math.max(40,*/ rect.size.x
        + (parts.includes("right") ? delta.x : 0)
        - (parts.includes("left")  ? delta.x : 0),
      y: /*Math.max(40,*/ rect.size.y
        + (parts.includes("bottom") ? delta.y : 0)
        - (parts.includes("top")    ? delta.y : 0),
    },
  };
}

export function transformLine(line: Line2D, parts: string[], delta: Vec2D): Line2D {
  return {
    start: parts.includes("start") ? addV2D(line.start, {x: delta.x, y: delta.y}) : line.start,
    end: parts.includes("end") ? addV2D(line.end, {x: delta.x, y: delta.y}) : line.end,
  };
}

// intersection point of two lines
// note: point may not be part of the lines
// author: ChatGPT
export function intersectLines(a: Line2D, b: Line2D): Vec2D | null {
  const { start: A1, end: A2 } = a;
  const { start: B1, end: B2 } = b;

  const den =
    (A1.x - A2.x) * (B1.y - B2.y) - (A1.y - A2.y) * (B1.x - B2.x);

  if (den === 0) return null; // parallel or coincident

  const x =
    ((A1.x * A2.y - A1.y * A2.x) * (B1.x - B2.x) -
      (A1.x - A2.x) * (B1.x * B2.y - B1.y * B2.x)) /
    den;

  const y =
    ((A1.x * A2.y - A1.y * A2.x) * (B1.y - B2.y) -
      (A1.y - A2.y) * (B1.x * B2.y - B1.y * B2.x)) /
    den;

  return { x, y };
}

export function euclideanDistance(a: Vec2D, b: Vec2D): number {
  const diffX = a.x - b.x;
  const diffY = a.y - b.y;
  return Math.hypot(diffX, diffY);
  // return Math.sqrt(diffX*diffX + diffY*diffY);
}

export function getLeftSide(rect: Rect2D): Line2D {
  return {
    start: rect.topLeft,
    end: {x: rect.topLeft.x, y: rect.topLeft.y + rect.size.y},
  };
}
export function getTopSide(rect: Rect2D): Line2D {
  return {
    start: rect.topLeft,
    end: { x: rect.topLeft.x + rect.size.x, y: rect.topLeft.y },
  };
}
export function getRightSide(rect: Rect2D): Line2D {
  return {
    start: { x: rect.topLeft.x + rect.size.x, y: rect.topLeft.y },
    end: { x: rect.topLeft.x + rect.size.x, y: rect.topLeft.y + rect.size.y },
  };
}
export function getBottomSide(rect: Rect2D): Line2D {
  return {
    start: { x: rect.topLeft.x, y: rect.topLeft.y + rect.size.y },
    end: { x: rect.topLeft.x + rect.size.x, y: rect.topLeft.y + rect.size.y },
  };
}

export type ArcDirection = "no" | "cw" | "ccw";

export function arcDirection(start: RectSide, end: RectSide): ArcDirection {
  if (start === end) {
    if (start === "left" || start === "top") {
      return "ccw";
    }
    else {
      return "cw";
    }
  }
  const both = [start, end];
  if (both.includes("top") && both.includes("bottom")) {
    return "no";
  }
  if (both.includes("left") && both.includes("right")) {
    return "no";
  }
  if (start === "top" && end === "left") {
    return "ccw";
  }
  if (start === "left" && end === "bottom") {
    return "ccw";
  }
  if (start === "bottom" && end === "right") {
    return "ccw";
  }
  if (start === "right" && end === "top") {
    return "ccw";
  }
  return "cw";
}

export const sides: [RectSide, (r: Rect2D) => Line2D][] = [
  ["left", getLeftSide],
  ["top", getTopSide],
  ["right", getRightSide],
  ["bottom", getBottomSide],
];


export function rotatePoint90CW(p: Vec2D, around: Vec2D): Vec2D {
  
  const result = {
    x: around.x - (p.y - around.y),
    y: around.y + (p.x - around.x),
  };
  console.log('rotate', p, 'around', around, 'result=', result);
  return result;
}

export function rotatePoint90CCW(p: Vec2D, around: Vec2D): Vec2D {
  return {
    x: around.x + (p.y - around.y),
    y: around.y - (p.x - around.x),
  };
}

function fixNegativeSize(r: Rect2D): Rect2D {
  return {
    topLeft: {
      x: r.size.x < 0 ? r.topLeft.x + r.size.x : r.topLeft.x,
      y: r.size.y < 0 ? r.topLeft.y + r.size.y : r.topLeft.y,
    },
    size: {
      x: Math.abs(r.size.x),
      y: Math.abs(r.size.y),
    },
  }
}

export function rotateRect90CCW(r: Rect2D, around: Vec2D): Rect2D {
  const rotated = {
    topLeft: rotatePoint90CCW(r.topLeft, around),
    size: rotatePoint90CCW(r.size, {x: 0, y: 0}),
  };
  return fixNegativeSize(rotated);
}


export function rotateRect90CW(r: Rect2D, around: Vec2D): Rect2D {
  const rotated = {
    topLeft: rotatePoint90CW(r.topLeft, around),
    size: rotatePoint90CW(r.size, {x: 0, y: 0}),
  };
  return fixNegativeSize(rotated);
}

export function rotateLine90CCW(l: Line2D, around: Vec2D): Line2D {
  return {
    start: rotatePoint90CCW(l.start, around),
    end: rotatePoint90CCW(l.end, around),
  };
}

export function rotateLine90CW(l: Line2D, around: Vec2D): Line2D {
  return {
    start: rotatePoint90CW(l.start, around),
    end: rotatePoint90CW(l.end, around),
  };
}

// Rounding coordinates saves a lot of data when serializing
export function roundVec2D(v: Vec2D): Vec2D {
  return {
    x: Math.round(v.x),
    y: Math.round(v.y),
  }
}
export function roundRect2D(r: Rect2D): Rect2D {
  return {
    topLeft: roundVec2D(r.topLeft),
    size: roundVec2D(r.size),
  }
}
export function roundLine2D(l: Line2D) : Line2D {
  return {
    start: roundVec2D(l.start),
    end: roundVec2D(l.end),
  }
}
