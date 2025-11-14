import { addV2D, rotateLine90CCW, rotateLine90CW, rotatePoint90CCW, rotatePoint90CW, rotateRect90CCW, rotateRect90CW, scaleV2D, subtractV2D, Vec2D } from "@/util/geometry";
import { HISTORY_RADIUS } from "../parameters";
import { Dispatch, SetStateAction, useCallback, useEffect } from "react";
import { EditHistory } from "../App";
import { jsonDeepEqual } from "@/util/util";
import { VisualEditorState } from "../VisualEditor/VisualEditor";

export function useEditor(setEditHistory: Dispatch<SetStateAction<EditHistory|null>>) {
  useEffect(() => {
    console.info("Welcome to StateBuddy!");
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
      if (selection.length === 0) {
        return editorState;
      }

      // determine bounding box... in a convoluted manner
      let minX = -Infinity, minY = -Infinity, maxX = Infinity, maxY = Infinity;
      function addPointToBBox({x,y}: Vec2D) {
        minX = Math.max(minX, x);
        minY = Math.max(minY, y);
        maxX = Math.min(maxX, x);
        maxY = Math.min(maxY, y);
      }
      for (const rt of editorState.rountangles) {
        if (selection.some(s => s.uid === rt.uid)) {
          addPointToBBox(rt.topLeft);
          addPointToBBox(addV2D(rt.topLeft, rt.size));
        }
      }
      for (const d of editorState.diamonds) {
        if (selection.some(s => s.uid === d.uid)) {
          addPointToBBox(d.topLeft);
          addPointToBBox(addV2D(d.topLeft, d.size));
        }
      }
      for (const arr of editorState.arrows) {
        if (selection.some(s => s.uid === arr.uid)) {
          addPointToBBox(arr.start);
          addPointToBBox(arr.end);
        }
      }
      for (const txt of editorState.texts) {
        if (selection.some(s => s.uid === txt.uid)) {
          addPointToBBox(txt.topLeft);
        }
      }
      const historySize = {x: HISTORY_RADIUS, y: HISTORY_RADIUS};
      for (const h of editorState.history) {
        if (selection.some(s => s.uid === h.uid)) {
          addPointToBBox(h.topLeft);
          addPointToBBox(addV2D(h.topLeft, scaleV2D(historySize, 2)));
        }
      }
      const center: Vec2D = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
      };
      const mapIfSelected = (shape: {uid: string}, cb: (shape:any)=>any) => {
        if (selection.some(s => s.uid === shape.uid)) {
          return cb(shape);
        }
        else {
          return shape;
        }
      }
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