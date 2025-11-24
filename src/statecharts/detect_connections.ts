import { isEntirelyWithin, Rect2D } from "@/util/geometry";
import { ConcreteSyntax, Rountangle } from "./concrete_syntax";
import { findNearestArrow, findNearestHistory, findNearestSide, findRountangle, RectSide } from "./concrete_syntax";
import { arraysEqual, jsonDeepEqual, mapsEqual, memoizeOne } from "@/util/util";
import { HISTORY_RADIUS } from "@/App/parameters";

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
  console.time("arrow <-> history")
  for (const arrow of concreteSyntax.arrows) {
    const historyTarget = findNearestHistory(arrow.end, concreteSyntax.history);
    if (historyTarget) {
      arrow2HistoryMap.set(arrow.uid, historyTarget.uid);
      history2ArrowMap.set(historyTarget.uid, [...(history2ArrowMap.get(historyTarget.uid) || []), arrow.uid]);
    }
  }
  console.timeEnd("arrow <-> history");
  return {arrow2HistoryMap, history2ArrowMap};
}, (a,b) => {
  let equal = true;
  equal &&= jsonDeepEqual(a.arrows, b.arrows);
  equal &&= jsonDeepEqual(a.diamonds, b.diamonds);
  equal &&= jsonDeepEqual(a.history, b.history);
  return equal;
})

const detectArrow2Side = memoizeOne(function detectArrow2Side(concreteSyntax: ConcreteSyntax) {
  const arrow2SideMap = new Map<string,[{ uid: string; part: RectSide; } | undefined, { uid: string; part: RectSide; } | undefined]>();
  const side2ArrowMap = new Map<string, ["start"|"end", string][]>();
  const {history2ArrowMap, arrow2HistoryMap} = detectArrow2History(concreteSyntax);
  console.time("arrow <-> side");
  
  const sides = [...concreteSyntax.rountangles, ...concreteSyntax.diamonds];
  for (const arrow of concreteSyntax.arrows) {
    // snap to rountangle/diamon side:
    const startSide = findNearestSide(arrow, "start", sides);
    const endSide = arrow2HistoryMap.get(arrow.uid) ? undefined : findNearestSide(arrow, "end", sides);
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
  console.timeEnd("arrow <-> side");
  return {history2ArrowMap, arrow2HistoryMap, arrow2SideMap, side2ArrowMap};

}, (a: ConcreteSyntax, b: ConcreteSyntax) => {
  let equal = true;
  equal &&= jsonDeepEqual(a.arrows, b.arrows);
  equal &&= jsonDeepEqual(a.diamonds, b.diamonds);
  equal &&= jsonDeepEqual(a.history, b.history);
  equal &&= jsonDeepEqual(a.rountangles, b.rountangles);
  return equal
});

export const detectTextConnections = memoizeOne(function detectTextConnections(concreteSyntax: ConcreteSyntax) {
  const text2ArrowMap = new Map<string,string>();
  const arrow2TextMap = new Map<string,string[]>();
  const text2RountangleMap = new Map<string, string>();
  const rountangle2TextMap = new Map<string, string[]>();
  console.time("text <-> arrow");
  // text <-> arrow
  for (const text of concreteSyntax.texts) {
    const nearestArrow = findNearestArrow(text.topLeft, concreteSyntax.arrows);
    if (nearestArrow) {
      // prioritize text belonging to arrows:
      text2ArrowMap.set(text.uid, nearestArrow.uid);
      const textsOfArrow = arrow2TextMap.get(nearestArrow.uid) || [];
      textsOfArrow.push(text.uid);
      arrow2TextMap.set(nearestArrow.uid, textsOfArrow);
    }
    else {
      // text <-> rountangle
      const rountangle = findRountangle(text.topLeft, concreteSyntax.rountangles);
      if (rountangle) {
        text2RountangleMap.set(text.uid, rountangle.uid);
        const texts = rountangle2TextMap.get(rountangle.uid) || [];
        texts.push(text.uid);
        rountangle2TextMap.set(rountangle.uid, texts);
      }
    }
  }
  console.timeEnd("text <-> arrow");
  return {text2ArrowMap, arrow2TextMap, text2RountangleMap, rountangle2TextMap};
}, (a,b) => {
  let equal = true;
  equal &&= jsonDeepEqual(a.arrows, b.arrows);
  equal &&= jsonDeepEqual(a.texts, b.texts);
  equal &&= jsonDeepEqual(a.rountangles, b.rountangles);
  return equal;
});

export const detectRountangleInsideness = memoizeOne(function detectRountangleInsideness(concreteSyntax: ConcreteSyntax) {
  const insidenessMap = new Map<string, string>();
  console.time("rectangle <-> rectangle")
  const parentCandidates: Rountangle[] = [{
    kind: "or",
    uid: "root",
    topLeft: {x: -Infinity, y: -Infinity},
    size: {x: Infinity, y: Infinity},
  }];
  function findParent(geom: Rect2D): string {
    // iterate in reverse:
    for (let i = parentCandidates.length-1; i >= 0; i--) {
      const candidate = parentCandidates[i];
      if (candidate.uid === "root" || isEntirelyWithin(geom, candidate)) {
        // found our parent
        return candidate.uid;
      }
    }
    throw new Error("impossible: should always find a parent state");
  }
  // IMPORTANT ASSUMPTION: state.rountangles is sorted from big to small surface area:
  for (const rt of concreteSyntax.rountangles) {
    const parent = findParent(rt);
    insidenessMap.set(rt.uid, parent);
    parentCandidates.push(rt);
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
}, (a,b) => {
  let equal = true;
  equal &&= jsonDeepEqual(a.rountangles, b.rountangles);
  equal &&= jsonDeepEqual(a.diamonds, b.diamonds);
  equal &&= jsonDeepEqual(a.history, b.history);
  return equal;
})

// This function does the heavy lifting of parsing the concrete syntax:
// It detects insideness and connectedness relations based on the geometries of the shapes.
export function detectConnections(concreteSyntax: ConcreteSyntax): Connections {
  // detect what is 'connected'
  const {arrow2SideMap, side2ArrowMap, history2ArrowMap, arrow2HistoryMap} = detectArrow2Side(concreteSyntax);
  const {text2ArrowMap, arrow2TextMap, text2RountangleMap, rountangle2TextMap} = detectTextConnections(concreteSyntax);
  const insidenessMap = detectRountangleInsideness(concreteSyntax);

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