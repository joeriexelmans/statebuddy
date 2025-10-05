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

export function transformRect(rect: Rect2D, parts: string[], delta: Vec2D): Rect2D {
  return {
    topLeft: {
      x: parts.includes("left") ? rect.topLeft.x + delta.x : rect.topLeft.x,
      y: parts.includes("top") ? rect.topLeft.y + delta.y : rect.topLeft.y,
    },
    size: {
      x: Math.max(40, rect.size.x
        + (parts.includes("right") ? delta.x : 0)
        - (parts.includes("left")  ? delta.x : 0)),
      y: Math.max(40, rect.size.y
        + (parts.includes("bottom") ? delta.y : 0)
        - (parts.includes("top")    ? delta.y : 0)),
    },
  };
}

export function transformLine(line: Line2D, parts: string[], delta: Vec2D): Line2D {
  return {
    start: parts.includes("start") ? addV2D(line.start, {x: delta.x, y: delta.y}) : line.start,
    end: parts.includes("end") ? addV2D(line.end, {x: delta.x, y: delta.y}) : line.end,
  };
}