import { findNearestArrow, findNearestHistory, findNearestSide, findRountangle, RountanglePart, VisualEditorState } from "./concrete_syntax";

export type Connections = {
  arrow2SideMap: Map<string,[{ uid: string; part: RountanglePart; } | undefined, { uid: string; part: RountanglePart; } | undefined]>,
  side2ArrowMap: Map<string, Set<["start"|"end", string]>>,
  text2ArrowMap: Map<string,string>,
  arrow2TextMap: Map<string,string[]>,
  arrow2HistoryMap: Map<string,string>,
  text2RountangleMap: Map<string, string>,
  rountangle2TextMap: Map<string, string[]>,
  history2ArrowMap: Map<string, string[]>,
}

export function detectConnections(state: VisualEditorState): Connections {
  // detect what is 'connected'
  const arrow2SideMap = new Map<string,[{ uid: string; part: RountanglePart; } | undefined, { uid: string; part: RountanglePart; } | undefined]>();
  const side2ArrowMap = new Map<string, Set<["start"|"end", string]>>();
  const text2ArrowMap = new Map<string,string>();
  const arrow2TextMap = new Map<string,string[]>();
  const arrow2HistoryMap = new Map<string,string>();
  const text2RountangleMap = new Map<string, string>();
  const rountangle2TextMap = new Map<string, string[]>();
  const history2ArrowMap = new Map<string, string[]>();

  // arrow <-> (rountangle | diamond)
  for (const arrow of state.arrows) {
    // snap to history:
    const historyTarget = findNearestHistory(arrow.end, state.history);
    if (historyTarget) {
      arrow2HistoryMap.set(arrow.uid, historyTarget.uid);
      history2ArrowMap.set(historyTarget.uid, [...(history2ArrowMap.get(historyTarget.uid) || []), arrow.uid]);
    }

    // snap to rountangle/diamon side:
    const sides = [...state.rountangles, ...state.diamonds];
    const startSide = findNearestSide(arrow, "start", sides);
    const endSide = historyTarget ? undefined : findNearestSide(arrow, "end", sides);
    if (startSide || endSide) {
      arrow2SideMap.set(arrow.uid, [startSide, endSide]);
    }
    if (startSide) {
      const arrowConns = side2ArrowMap.get(startSide.uid + '/' + startSide.part) || new Set();
      arrowConns.add(["start", arrow.uid]);
      side2ArrowMap.set(startSide.uid + '/' + startSide.part, arrowConns);
    }
    if (endSide) {
      const arrowConns = side2ArrowMap.get(endSide.uid + '/' + endSide.part) || new Set();
      arrowConns.add(["end", arrow.uid]);
      side2ArrowMap.set(endSide.uid + '/' + endSide.part, arrowConns);
    }
  }
  // text <-> arrow
  for (const text of state.texts) {
    const nearestArrow = findNearestArrow(text.topLeft, state.arrows);
    if (nearestArrow) {
      // prioritize text belonging to arrows:
      text2ArrowMap.set(text.uid, nearestArrow.uid);
      const textsOfArrow = arrow2TextMap.get(nearestArrow.uid) || [];
      textsOfArrow.push(text.uid);
      arrow2TextMap.set(nearestArrow.uid, textsOfArrow);
    }
    else {
      // text <-> rountangle
      const rountangle = findRountangle(text.topLeft, state.rountangles);
      if (rountangle) {
        text2RountangleMap.set(text.uid, rountangle.uid);
        const texts = rountangle2TextMap.get(rountangle.uid) || [];
        texts.push(text.uid);
        rountangle2TextMap.set(rountangle.uid, texts);
      }
    }
  }

  return {
    arrow2SideMap,
    side2ArrowMap,
    text2ArrowMap,
    arrow2TextMap,
    arrow2HistoryMap,
    text2RountangleMap,
    rountangle2TextMap,
    history2ArrowMap,
  };
}
