import { area, isEntirelyWithin, Rect2D, Vec2D } from "@/util/geometry";
import { Arrow, ConcreteSyntax, Diamond, getArrowFatBBox, getArrowFatBBoxes, getHistoryFatBBox, getRectFatBBox, getTextFatBBox, Rountangle } from "./concrete_syntax";
import { findNearestArrow, findNearestHistory, findNearestSide, findRountangle, RectSide } from "./concrete_syntax";
import { arraysEqual, jsonDeepEqual, mapsEqual, memoizeOne } from "@/util/util";
import { GRID_CELL_SIZE, HISTORY_RADIUS } from "@/App/parameters";

export type Connections = {
  arrow2SideMap: Map<string,[{ uid: string; part: RectSide; } | undefined, { uid: string; part: RectSide; } | undefined]>,
  side2ArrowMap: Map<string, ["start"|"end", string][]>,
  text2ArrowMap: Map<string,string>,
  arrow2TextMap: Map<string,string[]>,
  arrow2HistoryMap: Map<string,string>,
  text2RountangleMap: Map<string, string>,
  rountangle2TextMap: Map<string, string[]>,
  history2ArrowMap: Map<string, string[]>,
  insidenessMap: Map<string, string>;
}

export function connectionsEqual(a: Connections, b: Connections) {
  return mapsEqual(a.arrow2SideMap, b.arrow2SideMap, jsonDeepEqual)
    && mapsEqual(a.side2ArrowMap, b.side2ArrowMap, (a,b)=>arraysEqual(a,b,jsonDeepEqual))
    && mapsEqual(a.text2ArrowMap, b.text2ArrowMap)
    && mapsEqual(a.arrow2HistoryMap, b.arrow2HistoryMap)
    && mapsEqual(a.text2RountangleMap, b.text2RountangleMap)
    && mapsEqual(a.rountangle2TextMap, b.rountangle2TextMap, arraysEqual)
    && mapsEqual(a.history2ArrowMap, b.history2ArrowMap, arraysEqual)
    && mapsEqual(a.insidenessMap, b.insidenessMap)
}

const detectArrow2History = memoizeOne(function detectArrow2History(concreteSyntax: ConcreteSyntax) {
  const arrow2HistoryMap = new Map<string,string>();
  const history2ArrowMap = new Map<string, string[]>();
  // console.time("arrow <-> history")
  for (const arrow of concreteSyntax.arrows) {
    const historyTarget = findNearestHistory(arrow.end, concreteSyntax.history);
    if (historyTarget) {
      arrow2HistoryMap.set(arrow.uid, historyTarget.uid);
      history2ArrowMap.set(historyTarget.uid, [...(history2ArrowMap.get(historyTarget.uid) || []), arrow.uid]);
    }
  }
  // console.timeEnd("arrow <-> history");
  return {arrow2HistoryMap, history2ArrowMap};
}, (a,b) => {
  let equal = true;
  equal &&= jsonDeepEqual(a.arrows, b.arrows);
  equal &&= jsonDeepEqual(a.diamonds, b.diamonds);
  equal &&= jsonDeepEqual(a.history, b.history);
  return equal;
})

function* collect<T>(mappings: Map<number, T[]>[], cells: Iterable<number>) {
  const seen = new Set();
  for (const cell of cells) {
    for (const m of mappings) {
      const shapes = m.get(cell) || [];
      // iterate in reverse order
      for (let i=shapes.length-1; i>=0; i--) {
        const t = shapes[i];
        if (!seen.has(t)) {
          yield t;
        }
      }
    }
  }
}


const detectArrow2Side = memoizeOne(function detectArrow2Side([concreteSyntax, uniformGrid]: [ConcreteSyntax, any]) {
  const arrow2SideMap = new Map<string,[{ uid: string; part: RectSide; } | undefined, { uid: string; part: RectSide; } | undefined]>();
  const side2ArrowMap = new Map<string, ["start"|"end", string][]>();
  const {history2ArrowMap, arrow2HistoryMap} = detectArrow2History(concreteSyntax);
  // console.time("arrow <-> side");
  for (const arrow of concreteSyntax.arrows) {
    const [startBBox, endBBox] = getArrowFatBBoxes(arrow);
    const startSides = collect<Rountangle|Diamond>([uniformGrid.cell2Rountangles, uniformGrid.cell2Diamonds], getCells(startBBox));
    const endSides = collect<Rountangle|Diamond>([uniformGrid.cell2Rountangles, uniformGrid.cell2Diamonds], getCells(endBBox));
    const startSide = findNearestSide(arrow, "start", startSides);
    const endSide = arrow2HistoryMap.get(arrow.uid) ? undefined : findNearestSide(arrow, "end", endSides);
    if (startSide || endSide) {
      arrow2SideMap.set(arrow.uid, [startSide, endSide]);
    }
    if (startSide) {
      const arrowConns = side2ArrowMap.get(startSide.uid + '/' + startSide.part) || [];
      arrowConns.push(["start", arrow.uid]);
      side2ArrowMap.set(startSide.uid + '/' + startSide.part, arrowConns);
    }
    if (endSide) {
      const arrowConns = side2ArrowMap.get(endSide.uid + '/' + endSide.part) || [];
      arrowConns.push(["end", arrow.uid]);
      side2ArrowMap.set(endSide.uid + '/' + endSide.part, arrowConns);
    }
  }
  // console.timeEnd("arrow <-> side");
  return {history2ArrowMap, arrow2HistoryMap, arrow2SideMap, side2ArrowMap};
}, ([a], [b]) => {
  let equal = true;
  equal &&= jsonDeepEqual(a.arrows, b.arrows);
  equal &&= jsonDeepEqual(a.diamonds, b.diamonds);
  equal &&= jsonDeepEqual(a.history, b.history);
  equal &&= jsonDeepEqual(a.rountangles, b.rountangles);
  return equal
});

export const detectTextConnections = memoizeOne(function detectTextConnections([concreteSyntax, uniformGrid]: [ConcreteSyntax, any]) {
  const text2ArrowMap = new Map<string,string>();
  const arrow2TextMap = new Map<string,string[]>();
  const text2RountangleMap = new Map<string, string>();
  const rountangle2TextMap = new Map<string, string[]>();
  // console.time("text <-> arrow");
  // text <-> arrow
  for (const text of concreteSyntax.texts) {
    const textCells = [...getCells(getTextFatBBox(text))];
    const arrows = collect<Arrow>([uniformGrid.cell2Arrows], textCells);
    const nearestArrow = findNearestArrow(text.topLeft, arrows);
    if (nearestArrow) {
      // prioritize text belonging to arrows:
      text2ArrowMap.set(text.uid, nearestArrow.uid);
      const textsOfArrow = arrow2TextMap.get(nearestArrow.uid) || [];
      textsOfArrow.push(text.uid);
      arrow2TextMap.set(nearestArrow.uid, textsOfArrow);
    }
    else {
      // text <-> rountangle
      const rountangles = [...collect<Rountangle>([uniformGrid.cell2Rountangles], textCells)].sort((a,b) => area(b)-area(a));
      const rountangle = findRountangle(text.topLeft, rountangles);
      if (rountangle) {
        text2RountangleMap.set(text.uid, rountangle.uid);
        const texts = rountangle2TextMap.get(rountangle.uid) || [];
        texts.push(text.uid);
        rountangle2TextMap.set(rountangle.uid, texts);
      }
    }
  }
  // console.timeEnd("text <-> arrow");
  return {text2ArrowMap, arrow2TextMap, text2RountangleMap, rountangle2TextMap};
}, ([a],[b]) => {
  let equal = true;
  equal &&= jsonDeepEqual(a.arrows, b.arrows);
  equal &&= jsonDeepEqual(a.texts, b.texts);
  equal &&= jsonDeepEqual(a.rountangles, b.rountangles);
  return equal;
});

const fakeRoot = {
  uid: "root",
  topLeft: {x: -Infinity, y: -Infinity},
  size: {x: Infinity, y: Infinity},
}

export const detectRountangleInsideness = memoizeOne(function detectRountangleInsideness([concreteSyntax, uniformGrid]: [ConcreteSyntax, any]) {
  const insidenessMap = new Map<string, string>();
  console.time("rectangle <-> rectangle")
  function findParent(geom: Rect2D): string {
    // seems faster if we build an array than if we work with the generator object:
    const parentCandidates = collect<Rountangle>([uniformGrid.cell2Rountangles], getCells(geom));
    // iterate in reverse:
    for (const candidate of parentCandidates) {
      if (isEntirelyWithin(geom, candidate)) {
        // found our parent
        return candidate.uid;
      }
    }
    return "root";
  }
  // IMPORTANT ASSUMPTION: state.rountangles is sorted from big to small surface area:
  for (const rt of concreteSyntax.rountangles) {
    const parent = findParent(rt);
    insidenessMap.set(rt.uid, parent);
  }
  for (const d of concreteSyntax.diamonds) {
    const parent = findParent(d);
    insidenessMap.set(d.uid, parent);
  }
  for (const h of concreteSyntax.history) {
    const parent = findParent({topLeft: h.topLeft, size: {x: HISTORY_RADIUS*2, y: HISTORY_RADIUS*2}});
    insidenessMap.set(h.uid, parent);
  }
  console.timeEnd("rectangle <-> rectangle");
  return insidenessMap;
}, ([a],[b]) => {
  let equal = true;
  equal &&= jsonDeepEqual(a.rountangles, b.rountangles);
  equal &&= jsonDeepEqual(a.diamonds, b.diamonds);
  equal &&= jsonDeepEqual(a.history, b.history);
  return equal;
})

// This function does the heavy lifting of parsing the concrete syntax:
// It detects insideness and connectedness relations based on the geometries of the shapes.
export function detectConnections(concreteSyntax: ConcreteSyntax): Connections {
  console.time('detect connections');

  // we use 'Uniform Grid' (spatial hashing) approach for efficient collision detection
  // we build a map of grid cell -> shapes overlapping with that cell to find possible shapes that a shape is colliding with
  // console.time('build mapping')
  const cell2Rountangles = buildCell2ShapeMap(concreteSyntax.rountangles, getRectFatBBox);
  const cell2Arrows = buildCell2ShapeMap(concreteSyntax.arrows, getArrowFatBBox);
  const cell2Diamonds = buildCell2ShapeMap(concreteSyntax.diamonds, getRectFatBBox);
  // const cell2Histories = buildCell2ShapeMap(concreteSyntax.history, getHistoryFatBBox);
  // const cell2Texts = buildCell2ShapeMap(concreteSyntax.texts, getTextFatBBox);
  // console.timeEnd('build mapping')
  const uniformGrid = {cell2Rountangles, cell2Arrows, cell2Diamonds};


  // detect what is 'connected'
  const {arrow2SideMap, side2ArrowMap, history2ArrowMap, arrow2HistoryMap} = detectArrow2Side([concreteSyntax, uniformGrid]);
  const {text2ArrowMap, arrow2TextMap, text2RountangleMap, rountangle2TextMap} = detectTextConnections([concreteSyntax, uniformGrid]);
  const insidenessMap = detectRountangleInsideness([concreteSyntax, uniformGrid]);

  console.timeEnd('detect connections');

  return {
    arrow2SideMap,
    side2ArrowMap,
    text2ArrowMap,
    arrow2TextMap,
    arrow2HistoryMap,
    text2RountangleMap,
    rountangle2TextMap,
    history2ArrowMap,
    insidenessMap,
  };
}

export type ReducedConcreteSyntax = {
    rountangles: {
      kind: "and" | "or",
      uid: string,
    }[];
    texts: {
      text: string,
      uid: string,
    }[];
    arrows: {
      uid: string,
    }[];
    diamonds: {
      uid: string,
    }[];
    history: {
      kind: "deep" | "shallow",
      uid: string,
    }[];
};

export function reducedConcreteSyntaxEqual(a: ReducedConcreteSyntax, b: ReducedConcreteSyntax) {
  return arraysEqual(a.rountangles, b.rountangles, (a,b)=>a.kind===b.kind&&a.uid===b.uid)
    && arraysEqual(a.texts, b.texts, (a,b)=>a.text===b.text&&a.uid===b.uid)
    && arraysEqual(a.arrows, b.arrows, (a,b)=>a.uid===b.uid)
    && arraysEqual(a.diamonds, b.diamonds, (a,b)=>a.uid===b.uid)
    && arraysEqual(a.history, b.history, (a,b)=>a.kind===b.kind&&a.uid===b.uid);
}


function gridCellIdx(x: number) {
  return Math.floor(x/GRID_CELL_SIZE);
}

const shiftBits = 26;

export function* getCells(bbox: Rect2D) {
  const minI = gridCellIdx(bbox.topLeft.x);
  const minJ = gridCellIdx(bbox.topLeft.y);
  const maxI = gridCellIdx(bbox.topLeft.x + bbox.size.x);
  const maxJ = gridCellIdx(bbox.topLeft.y + bbox.size.y);
  for (let i=minI; i<=maxI; i++) {
    for (let j=minJ; j<=maxJ; j++) {
      yield i+(j<<shiftBits); // pack two numbers into one - works as long as we dont have 2^26 horizontal columns
    }
  }
}

export function decodeCell(cell: number): Vec2D {
  return {
    x: (cell & ~(0xffffff<<shiftBits))*GRID_CELL_SIZE,
    y: (cell >> shiftBits)*GRID_CELL_SIZE,
  }
}

export function buildCell2ShapeMap<T>(shapes: T[], getFatBBox: (shape: T) => Rect2D) {
  const cell2Shapes = new Map<number, T[]>();
  for (const shape of shapes) {
    for (const cell of getCells(getFatBBox(shape))) {
      const cellShapes = cell2Shapes.get(cell) || [];
      cellShapes.push(shape);
      cell2Shapes.set(cell, cellShapes);
    }
  }
  return cell2Shapes;
}
