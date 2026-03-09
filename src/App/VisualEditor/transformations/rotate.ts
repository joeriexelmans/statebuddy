import { HISTORY_RADIUS } from "@/App/parameters";
import { entirelySelectedShapes, shapesBBox } from "@/statecharts/concrete_syntax";
import { centerOf, rotateRect90CCW, rotateRect90CW, rotateLine90CCW, rotateLine90CW, rotatePoint90CCW, rotatePoint90CW, subtractV2D, addV2D } from "@/util/geometry";
import { VisualEditorState } from "../VisualEditor.state";


export function rotateSelection(editorState: VisualEditorState, direction: "ccw"|"cw") {
  const selection = editorState.selection;
  const selectedShapes = entirelySelectedShapes(editorState, selection);
  const bbox = shapesBBox(selectedShapes);
  if (!bbox) {
    return editorState; // no change
  }
  const center = centerOf(bbox);
  const mapIfSelected = (shape: {uid: string}, cb: (shape:any)=>any) => {
    if (selection.has(shape.uid)) {
      return cb(shape);
    }
    else {
      return shape;
    }
  }
  const historySize = {x: HISTORY_RADIUS, y: HISTORY_RADIUS};
  return {
    ...editorState,
    rountangles: editorState.rountangles.map(rt => mapIfSelected(rt, rt => {
      return {
        ...rt,
        ...(direction === "ccw"
          ? rotateRect90CCW(rt, center)
          : rotateRect90CW(rt, center)),
      }
    })),
    arrows: editorState.arrows.map(arr => mapIfSelected(arr, arr => {
      return {
        ...arr,
        ...(direction === "ccw"
          ? rotateLine90CCW(arr, center)
          : rotateLine90CW(arr, center)),
      };
    })),
    diamonds: editorState.diamonds.map(d => mapIfSelected(d, d => {
      return {
        ...d,
        ...(direction === "ccw"
          ? rotateRect90CCW(d, center)
          : rotateRect90CW(d, center)),
      };
    })),
    texts: editorState.texts.map(txt => mapIfSelected(txt, txt => {
      return {
        ...txt,
        topLeft: (direction === "ccw"
          ? rotatePoint90CCW(txt.topLeft, center)
          : rotatePoint90CW(txt.topLeft, center)),
      };
    })),
    history: editorState.history.map(h => mapIfSelected(h, h => {
      return {
        ...h,
        topLeft: (direction === "ccw"
          ? subtractV2D(rotatePoint90CCW(addV2D(h.topLeft, historySize), center), historySize)
          : subtractV2D(rotatePoint90CW(addV2D(h.topLeft, historySize), center), historySize)
        ),
      };
    })),
  };
}
