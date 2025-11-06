import { addV2D, rotateLine90CCW, rotateLine90CW, rotatePoint90CCW, rotatePoint90CW, rotateRect90CCW, rotateRect90CW, scaleV2D, subtractV2D, Vec2D } from "@/util/geometry";
import { HISTORY_RADIUS } from "./parameters";
import { Dispatch, SetStateAction, useCallback, useEffect } from "react";
import { EditHistory } from "./App";
import { VisualEditorState } from "./VisualEditor/VisualEditor";

export function useEditor(setEditHistory: Dispatch<SetStateAction<EditHistory|null>>) {
  useEffect(() => {
    console.info("Welcome to StateBuddy!");
    () => {
      console.info("Goodbye!");
    }
  }, []);

  // append editor state to undo history
  const makeCheckPoint = useCallback(() => {
    setEditHistory(historyState => historyState && ({
      ...historyState,
      history: [...historyState.history, historyState.current],
      future: [],
    }));
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
    makeCheckPoint();
    setEditHistory(historyState => {
      if (historyState === null) return null;

      const selection = historyState.current.selection;

      if (selection.length === 0) {
        return historyState;
      }

      // determine bounding box... in a convoluted manner
      let minX = -Infinity, minY = -Infinity, maxX = Infinity, maxY = Infinity;

      function addPointToBBox({x,y}: Vec2D) {
        minX = Math.max(minX, x);
        minY = Math.max(minY, y);
        maxX = Math.min(maxX, x);
        maxY = Math.min(maxY, y);
      }

      for (const rt of historyState.current.rountangles) {
        if (selection.some(s => s.uid === rt.uid)) {
          addPointToBBox(rt.topLeft);
          addPointToBBox(addV2D(rt.topLeft, rt.size));
        }
      }
      for (const d of historyState.current.diamonds) {
        if (selection.some(s => s.uid === d.uid)) {
          addPointToBBox(d.topLeft);
          addPointToBBox(addV2D(d.topLeft, d.size));
        }
      }
      for (const arr of historyState.current.arrows) {
        if (selection.some(s => s.uid === arr.uid)) {
          addPointToBBox(arr.start);
          addPointToBBox(arr.end);
        }
      }
      for (const txt of historyState.current.texts) {
        if (selection.some(s => s.uid === txt.uid)) {
          addPointToBBox(txt.topLeft);
        }
      }
      const historySize = {x: HISTORY_RADIUS, y: HISTORY_RADIUS};
      for (const h of historyState.current.history) {
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
        ...historyState,
        current: {
          ...historyState.current,
          rountangles: historyState.current.rountangles.map(rt => mapIfSelected(rt, rt => {
            return {
              ...rt,
              ...(direction === "ccw"
                ? rotateRect90CCW(rt, center)
                : rotateRect90CW(rt, center)),
            }
          })),
          arrows: historyState.current.arrows.map(arr => mapIfSelected(arr, arr => {
            return {
              ...arr,
              ...(direction === "ccw"
                ? rotateLine90CCW(arr, center)
                : rotateLine90CW(arr, center)),
            };
          })),
          diamonds: historyState.current.diamonds.map(d => mapIfSelected(d, d => {
            return {
              ...d,
              ...(direction === "ccw"
                ? rotateRect90CCW(d, center)
                : rotateRect90CW(d, center)),
            };
          })),
          texts: historyState.current.texts.map(txt => mapIfSelected(txt, txt => {
              return {
                ...txt,
                topLeft: (direction === "ccw"
                  ? rotatePoint90CCW(txt.topLeft, center)
                  : rotatePoint90CW(txt.topLeft, center)),
              };
          })),
          history: historyState.current.history.map(h => mapIfSelected(h, h => {
              return {
                ...h,
                topLeft: (direction === "ccw"
                  ? subtractV2D(rotatePoint90CCW(addV2D(h.topLeft, historySize), center), historySize)
                  : subtractV2D(rotatePoint90CW(addV2D(h.topLeft, historySize), center), historySize)
                ),
              };
          })),
        },
      }
    })
  }, [setEditHistory]);
  
  return {makeCheckPoint, onUndo, onRedo, onRotate};
}