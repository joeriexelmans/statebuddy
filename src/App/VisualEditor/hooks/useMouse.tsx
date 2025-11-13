import { rountangleMinSize } from "@/statecharts/concrete_syntax";
import { addV2D, area, isEntirelyWithin, normalizeRect, scaleV2D, subtractV2D, transformLine, transformRect } from "@/util/geometry";
import { getBBoxInSvgCoords } from "@/util/svg_helper";
import { Dispatch, useCallback, useEffect, useState } from "react";
import { MIN_ROUNTANGLE_SIZE } from "../../parameters";
import { InsertMode } from "../../TopPanel/InsertModes";
import { Selecting, SelectingState } from "../Selection";
import { Selection, VisualEditorState } from "../VisualEditor";

export function useMouse(makeCheckPoint: () => void, insertMode: InsertMode, zoom: number, refSVG: {current: SVGSVGElement|null}, state: VisualEditorState, setState: Dispatch<(v: VisualEditorState) => VisualEditorState>, deleteSelection: () => void) {
  const [dragging, setDragging] = useState(false);
  const [shiftOrCtrlPressed, setShiftOrCtrlPressed] = useState(false);

  // not null while the user is making a selection
  const [selectingState, setSelectingState] = useState<SelectingState>(null);

  const selection = state.selection;
  const setSelection = useCallback((cb: (oldSelection: Selection) => Selection) =>
    setState(oldState => ({...oldState, selection: cb(oldState.selection)})),[setState]);

  const getCurrentPointer = useCallback((e: {pageX: number, pageY: number}) => {
    const bbox = refSVG.current!.getBoundingClientRect();
    return {
      x: (e.pageX - bbox.left)/zoom,
      y: (e.pageY - bbox.top)/zoom,
    }
  }, [refSVG.current, zoom]);

  const onMouseDown = useCallback((e: {button: number, target: any, pageX: number, pageY: number}) => {
    const currentPointer = getCurrentPointer(e);
    if (e.button === 2) {
      makeCheckPoint();
      // ignore selection, right mouse button always inserts
      setState(state => {
        const newID = state.nextID.toString();
        if (insertMode === "and" || insertMode === "or") {
          // insert rountangle
          return {
            ...state,
            rountangles: [...state.rountangles, {
              uid: newID,
              topLeft: currentPointer,
              size: MIN_ROUNTANGLE_SIZE,
              kind: insertMode,
            }],
            nextID: state.nextID+1,
            selection: [{uid: newID, part: "bottom"}, {uid: newID, part: "right"}],
          };
        }
        else if (insertMode === "pseudo") {
          return {
            ...state,
            diamonds: [...state.diamonds, {
              uid: newID,
              topLeft: currentPointer,
              size: MIN_ROUNTANGLE_SIZE,
            }],
            nextID: state.nextID+1,
            selection: [{uid: newID, part: "bottom"}, {uid: newID, part: "right"}],
          };
        }
        else if (insertMode === "shallow" || insertMode === "deep") {
          return {
            ...state,
            history: [...state.history, {
              uid: newID,
              kind: insertMode,
              topLeft: currentPointer,
            }],
            nextID: state.nextID+1,
            selection: [{uid: newID, part: "history"}],
          }
        }
        else if (insertMode === "transition") {
          return {
            ...state,
            arrows: [...state.arrows, {
              uid: newID,
              start: currentPointer,
              end: currentPointer,
            }],
            nextID: state.nextID+1,
            selection: [{uid: newID, part: "end"}],
          }
        }
        else if (insertMode === "text") {
          return {
            ...state,
            texts: [...state.texts, {
              uid: newID,
              text: "// Double-click to edit",
              topLeft: currentPointer,
            }],
            nextID: state.nextID+1,
            selection: [{uid: newID, part: "text"}],
          }
        }
        throw new Error("unreachable, mode=" + insertMode); // shut up typescript
      });
      setDragging(true);
      return;
    }

    if (e.button === 0) {
      if (!shiftOrCtrlPressed) {
        // left mouse button on a shape will drag that shape (and everything else that's selected). if the shape under the pointer was not in the selection then the selection is reset to contain only that shape.
        const uid = e.target?.dataset.uid;
        const parts: string[] = e.target?.dataset.parts?.split(' ').filter((p:string) => p!=="") || [];
        if (uid && parts.length > 0) {
          makeCheckPoint();

          // if the mouse button is pressed outside of the current selection, we reset the selection to whatever shape the mouse is on
          let allPartsInSelection = true;
          for (const part of parts) {
            // is there anything in our existing selection that is not under the cursor?
            if (!(selection.some(s => (s.uid === uid) && (s.part === part)))) {
              allPartsInSelection = false;
              break;
            }
          }
          if (!allPartsInSelection) {
            if (e.target.classList.contains("helper")) {
              setSelection(() => parts.map(part => ({uid, part})) as Selection);
            }
            else {
              setDragging(false);
              setSelectingState({
                topLeft: currentPointer,
                size: {x: 0, y: 0},
              });
              setSelection(() => []);
              return;
            }
          }
          // start dragging
          setDragging(true);
          return;
        }
      }
    }

    // otherwise, just start making a selection
    setDragging(false);
    setSelectingState({
      topLeft: currentPointer,
      size: {x: 0, y: 0},
    });
    if (!shiftOrCtrlPressed) {
      setSelection(() => []);
    }
  }, [getCurrentPointer, makeCheckPoint, insertMode, selection, shiftOrCtrlPressed]);

  const onMouseMove = useCallback((e: {pageX: number, pageY: number, movementX: number, movementY: number}) => {
    const currentPointer = getCurrentPointer(e);
    if (dragging) {
      // const pointerDelta = subtractV2D(currentPointer, dragging.lastMousePos);
      const pointerDelta = {x: e.movementX/zoom, y: e.movementY/zoom};
      const getParts = (uid: string) => {
        return state.selection.filter(s => s.uid === uid).map(s => s.part);
      }
      setState(state => ({
        ...state,
        rountangles: state.rountangles.map(r => {
          const selectedParts = getParts(r.uid);
          if (selectedParts.length === 0) {
            return r;
          }
          return {
            ...r,
            ...transformRect(r, selectedParts, pointerDelta),
          };
        })
        .toSorted((a,b) => area(b) - area(a)), // sort: smaller rountangles are drawn on top
        diamonds: state.diamonds.map(d => {
          const selectedParts = getParts(d.uid);
          if (selectedParts.length === 0) {
            return d;
          }
          return {
            ...d,
            ...transformRect(d, selectedParts, pointerDelta),
          }
        }),
        history: state.history.map(h => {
          const selectedParts = getParts(h.uid);
          if (selectedParts.length === 0) {
            return h;
          }
          return {
            ...h,
            topLeft: addV2D(h.topLeft, pointerDelta),
          }
        }),
        arrows: state.arrows.map(a => {
          const selectedParts = getParts(a.uid);
          if (selectedParts.length === 0) {
            return a;
          }
          return {
            ...a,
            ...transformLine(a, selectedParts, pointerDelta),
          }
        }),
        texts: state.texts.map(t => {
          const selectedParts = getParts(t.uid);
          if (selectedParts.length === 0) {
            return t;
          }
          return {
            ...t,
            topLeft: addV2D(t.topLeft, pointerDelta),
          }
        }),
      }));
      setDragging(true);
    }
    else if (selectingState) {
      setSelectingState(ss => {
        const selectionSize = subtractV2D(currentPointer, ss!.topLeft);
        return {
          ...ss!,
          size: selectionSize,
        };
      });
    }
  }, [getCurrentPointer, selectingState, dragging]);

  const onMouseUp = useCallback((e: {target: any, pageX: number, pageY: number}) => {
    if (dragging) {
      setDragging(false);
      // do not persist sizes smaller than 40x40
      setState(state => {
        return {
          ...state,
          rountangles: state.rountangles.map(r => ({
            ...r,
            size: rountangleMinSize(r.size),
          })),
          diamonds: state.diamonds.map(d => ({
            ...d,
            size: rountangleMinSize(d.size),
          }))
        };
      });
    }
    if (selectingState) {
      if (selectingState.size.x === 0 && selectingState.size.y === 0) {
        const uid = e.target?.dataset.uid;
        if (uid) {
          const parts = e.target?.dataset.parts.split(' ').filter((p: string) => p!=="") || [];
          if (uid) {
            setSelection(oldSelection => [
              ...oldSelection,
              ...parts.map((part: string) => ({uid, part})),
            ]);
          }
        }
      }
      else {
        // we were making a selection
        const normalizedSS = normalizeRect(selectingState);
        const shapes = Array.from(refSVG.current?.querySelectorAll("rect, line, circle, text") || []) as SVGGraphicsElement[];
        const shapesInSelection = shapes.filter(el => {
          const bbox = getBBoxInSvgCoords(el, refSVG.current!);
          const scaledBBox = {
            topLeft: scaleV2D(bbox.topLeft, 1/zoom),
            size: scaleV2D(bbox.size, 1/zoom),
          }
          return isEntirelyWithin(scaledBBox, normalizedSS);
        }).filter(el => !el.classList.contains("corner"));
        
        // @ts-ignore
        setSelection(oldSelection => {
          const newSelection = [];
          const common = [];
          for (const shape of shapesInSelection) {
            const uid = shape.dataset.uid;
            if (uid) {
              const parts = shape.dataset.parts?.split(' ') || [];
              for (const part of parts) {
                if (oldSelection.some(({uid: oldUid, part: oldPart}) =>
                  uid === oldUid && part === oldPart)) {
                    common.push({uid, part});
                  
                }
                else {
                  newSelection.push({uid, part});
                }
              } 
            }
          }
          return [...oldSelection, ...newSelection];
        })
      }
    }
    setSelectingState(null); // no longer making a selection
  }, [dragging, selectingState, refSVG.current]);

  const trackShiftKey = useCallback((e: KeyboardEvent) => {
    // @ts-ignore
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;

    if (e.shiftKey || e.ctrlKey) {
      setShiftOrCtrlPressed(true);
    }
    else {
      setShiftOrCtrlPressed(false);
    }
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    // don't capture keyboard events when focused on an input element:
    // @ts-ignore
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;

    if (e.key === "o") {
      // selected states become OR-states
      setState(state => ({
        ...state,
        rountangles: state.rountangles.map(r => state.selection.some(rs => rs.uid === r.uid) ? ({...r, kind: "or"}) : r),
      }));
    }
    if (e.key === "a") {
      // selected states become AND-states
      setState(state => ({
        ...state,
        rountangles: state.rountangles.map(r => state.selection.some(rs => rs.uid === r.uid) ? ({...r, kind: "and"}) : r),
      }));
    }
    // if (e.key === "p") {
    //   // selected states become pseudo-states
    //   setSelection(selection => {
    //     setState(state => ({
    //       ...state,
    //       rountangles: state.rountangles.map(r => selection.some(rs => rs.uid === r.uid) ? ({...r, kind: "pseudo"}) : r),
    //     }));
    //     return selection;
    //   });
    // }
    if (e.ctrlKey) {
      if (e.key === "a") {
        e.preventDefault();
        setDragging(false);
        setState(state => ({
          ...state,
          // @ts-ignore
          selection: [
            ...state.rountangles.flatMap(r => ["left", "top", "right", "bottom"].map(part => ({uid: r.uid, part}))),
            ...state.diamonds.flatMap(d => ["left", "top", "right", "bottom"].map(part => ({uid: d.uid, part}))),
            ...state.arrows.flatMap(a => ["start", "end"].map(part => ({uid: a.uid, part}))),
            ...state.texts.map(t => ({uid: t.uid, part: "text"})),
            ...state.history.map(h => ({uid: h.uid, part: "history"})),
          ]
        }))
      }
    }
  }, [makeCheckPoint, deleteSelection, setState, setDragging]);

  useEffect(() => {
    // mousemove and mouseup are global event handlers so they keep working when pointer is outside of browser window
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", trackShiftKey);
    window.addEventListener("keyup", trackShiftKey);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", trackShiftKey);
      window.removeEventListener("keyup", trackShiftKey);
    };
  }, [selectingState, dragging]);

  return {onMouseDown, selectionRect: selectingState && <Selecting {...selectingState} />};
}
