import { addV2D, centerOf, rotateLine90CCW, rotateLine90CW, rotatePoint90CCW, rotatePoint90CW, rotateRect90CCW, rotateRect90CW, subtractV2D, Vec2D } from "@/util/geometry";
import { EDITOR_HEIGHT, EDITOR_WIDTH, HISTORY_RADIUS } from "../parameters";
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { AppState, EditHistory } from "../App";
import { Selection, VisualEditorState } from "../VisualEditor/VisualEditor";
import { useTrial } from "./useTrial";
import { emptyEditorState, entirelySelectedShapes, initialEditorState, shapesBBox } from "@/statecharts/concrete_syntax";
import { useCopyPaste } from "../VisualEditor/hooks/useCopyPaste";
import { mergeSelections, useMouse } from "../VisualEditor/hooks/useMouse";
import { Selecting, SelectingState } from "../VisualEditor/Selection";
import { ToolSelectState } from "../TopPanel/ToolSelect";

export function useEditor(state: VisualEditorState|null, setEditHistory: Dispatch<SetStateAction<EditHistory|null>>, {leftMouseMode, middleMouseMode, insertMode, zoom}: ToolSelectState & {zoom: number}) {
  const {appName} = useTrial();
  useEffect(() => {
    console.info(`Welcome to ${appName}!`);
    () => {
      console.info("Goodbye!");
    }
  }, []);

  // creates new entry in undo history
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

  // overwrites last entry in undo history
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

  // if not dragging: null
  // if dragging: position of cursor at last mouse event
  const [dragging, setDragging] = useState<Vec2D|null>(null);

  // not null while the user is making a selection
  const [selectingState, setSelectingState] = useState<SelectingState>(null);

  const refSVG = useRef<SVGSVGElement>(null);

  // even though the VisualEditor component is not rendered unless we have a valid application state (which we don't while we are still loading the state from the URL asynchronously), hooks cannot be called conditionally, so we need *some* state to pass to them.
  const stateOrDefaultState = state || emptyEditorState;

  const {onMouseDown, newSelection, cursorPos} = useMouse(
    dragging, setDragging,
    selectingState, setSelectingState,
    leftMouseMode, middleMouseMode, insertMode,
    zoom, refSVG, stateOrDefaultState.selection,
    commitState, replaceState);

  const renderSelection = mergeSelections(stateOrDefaultState.selection, newSelection);

  // copy/paste depends on 'useMouse' (it updates the 'dragging' state on paste)
  const startDragging = useCallback(() => setDragging(cursorPos), [setDragging, cursorPos]);
  const copyPasteCallbacks = useCopyPaste(stateOrDefaultState, commitState, renderSelection, startDragging, cursorPos);

  // const viewBox = `0 0 ${EDITOR_WIDTH} ${EDITOR_HEIGHT}`;
  // const renderSvg = (renderChildren: (selection: Selection)) => <svg width={EDITOR_WIDTH*zoom} height={EDITOR_HEIGHT*zoom}
  //     className={styles.svgCanvas
  //       + ' ' + (highlightActive.has("root") ? styles.active : "")
  //       + ' ' + (dragging ? styles.dragging : "")}
  //     onMouseDown={onMouseDown}
  //     onContextMenu={e => e.preventDefault()}
  //     ref={refSVG}
  //     {...copyPasteCallbacks}
  //     viewBox={viewBox}
  // >
  //   {renderChildren(renderSelection)}
  // </svg>;

  return {
    commitState, replaceState,
    onMouseDown,
    onUndo, onRedo,
    onRotate,
    ...copyPasteCallbacks,
    refSVG,
    dragging: Boolean(dragging),
    startDragging,
    renderSelection,
    selectingState,
    // renderSvg,
  };
}
