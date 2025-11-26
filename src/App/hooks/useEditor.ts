import { addV2D, centerOf, rotateLine90CCW, rotateLine90CW, rotatePoint90CCW, rotatePoint90CW, rotateRect90CCW, rotateRect90CW, subtractV2D } from "@/util/geometry";
import { HISTORY_RADIUS } from "../parameters";
import { Dispatch, SetStateAction, useCallback, useEffect } from "react";
import { EditHistory } from "../App";
import { VisualEditorState } from "../VisualEditor/VisualEditor";
import { useTrial } from "./useTrial";
import { entirelySelectedShapes, shapesBBox } from "@/statecharts/concrete_syntax";

export function useEditor(setEditHistory: Dispatch<SetStateAction<EditHistory|null>>) {
  const {appName} = useTrial();
  useEffect(() => {
    console.info(`Welcome to ${appName}!`);
    () => {
      console.info("Goodbye!");
    }
  }, []);

  const commitState = useCallback((callback: (oldState: VisualEditorState) => VisualEditorState) => {
    setEditHistory(historyState => {
      if (historyState === null) return null; // no change
      const newEditorState = callback(historyState.current);
        return {
          current: newEditorState,
          history: [...historyState.history, historyState.current],
          future: [],
        }
      // }
    });
  }, [setEditHistory]);
  const replaceState = useCallback((callback: (oldState: VisualEditorState) => VisualEditorState) => {
    setEditHistory(historyState => {
      if (historyState === null) return null; // no change
      const newEditorState = callback(historyState.current);
      return {
        ...historyState,
        current: newEditorState,
      };
    });
  }, [setEditHistory]);
  const onUndo = useCallback(() => {
    setEditHistory(historyState => {
      if (historyState === null) return null;
      if (historyState.history.length === 0) {
        return historyState; // no change
      }
      return {
        current: historyState.history.at(-1)!,
        history: historyState.history.slice(0,-1),
        future: [...historyState.future, historyState.current],
      }
    })
  }, [setEditHistory]);
  const onRedo = useCallback(() => {
    setEditHistory(historyState => {
      if (historyState === null) return null;
      if (historyState.future.length === 0) {
        return historyState; // no change
      }
      return {
        current: historyState.future.at(-1)!,
        history: [...historyState.history, historyState.current],
        future: historyState.future.slice(0,-1),
      }
    });
  }, [setEditHistory]);
  const onRotate = useCallback((direction: "ccw" | "cw") => {
    commitState(editorState => {
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
    });
  }, [setEditHistory]);
  return {commitState, replaceState, onUndo, onRedo, onRotate};
}