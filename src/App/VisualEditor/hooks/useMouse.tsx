import { allArrowParts, allHistoryParts, allRectParts, allTextParts, rountangleMinSize } from "@/statecharts/concrete_syntax";
import { addV2D, area, isEntirelyWithin, normalizeRect, Rect2D, roundLine2D, roundRect2D, roundVec2D, scaleV2D, subtractV2D, transformLine, transformRect, Vec2D } from "@/util/geometry";
import { getBBoxInSvgCoords } from "@/util/svg_helper";
import { Dispatch, useCallback, useEffect, useMemo, useState } from "react";
import { MIN_ROUNTANGLE_SIZE } from "../../parameters";
import { InsertMode } from "../../TopPanel/InsertModes";
import { Selecting, SelectingState } from "../Selection";
import { Parts, Selection, VisualEditorState } from "../VisualEditor";
import { useShortcuts } from "@/hooks/useShortcuts";

// get list of parts of shapes that are within the selecting-rectangle
function computeSelection(ss: SelectingState, refSVG: {current: SVGSVGElement | null}, zoom: number): Selection {
  if (ss) {
    // complete selection
    const normalizedSS = normalizeRect(ss);
    const shapes = Array.from(refSVG.current?.querySelectorAll("rect, line, circle, text") || []) as SVGGraphicsElement[];
    // Note: the same UID may be represented by multiple 'shapes'. Every 'shape' can represent any number of 'parts'.
    const shapesInSelection = shapes.filter(el => {
      const bbox = getBBoxInSvgCoords(el, refSVG.current!);
      const scaledBBox = {
        topLeft: scaleV2D(bbox.topLeft, 1/zoom),
        size: scaleV2D(bbox.size, 1/zoom),
      }
      return isEntirelyWithin(scaledBBox, normalizedSS);
    }).filter(el => !el.classList.contains("corner"));

    const selection: Selection = new Selection();
    for (const shape of shapesInSelection) {
      const uid = shape.dataset.uid;
      if (uid) {
        const parts = new Parts(shape.dataset.parts?.split(' ') || []);
        for (const part of parts) {
          selection.set(uid, (selection.get(uid) as Parts || new Parts()).add(part));
        }
      }
    }
    return selection;
  }
  return new Selection();
}

export function useMouse(
  insertMode: InsertMode,
  zoom: number,
  refSVG: {current: SVGSVGElement|null},
  state: VisualEditorState,
  commitState: Dispatch<(v: VisualEditorState) => VisualEditorState>,
  replaceState: Dispatch<(v: VisualEditorState) => VisualEditorState>)
{
  const [dragging, setDragging] = useState(false);
  const [shiftOrCtrlPressed, setShiftOrCtrlPressed] = useState(false);

  // not null while the user is making a selection
  const [selectingState, setSelectingState] = useState<SelectingState>(null);

  const selection = state.selection;
  const commitSelection = useCallback((cb: (oldSelection: Selection) => Selection) => {
    commitState(oldState => ({...oldState, selection: cb(oldState.selection)}));
  },[commitState]);

  const replaceSelection = useCallback((cb: (oldSelection: Selection) => Selection) =>
    replaceState(oldState => ({...oldState, selection: cb(oldState.selection)})),[replaceState]);

  // selection being made
  const newSelection: Selection = useMemo(() =>
    computeSelection(selectingState, refSVG, zoom),
    [selectingState, refSVG, zoom]);


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
      // ignore selection, right mouse button always inserts
      commitState(state => {
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
            selection: new Selection([[newID, new Parts(["bottom", "right"])]]),
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
            selection: new Selection([[newID, new Parts(["bottom", "right"])]]),
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
            selection: new Selection([[newID, new Parts(["history"])]]),
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
            selection: new Selection([[newID, new Parts(["end"])]]),
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
            selection: new Selection([[newID, new Parts(["text"])]]),
          }
        }
        throw new Error("unreachable, mode=" + insertMode); // shut up typescript
      });
      setDragging(true);
      return;
    }

    let appendTo: Selection;
    if (shiftOrCtrlPressed) {
      appendTo = selection;
    }
    else {
      appendTo = new Selection();
    }

    const startMakingSelection = () => {
      setDragging(false);
      setSelectingState({
        topLeft: currentPointer,
        size: {x: 0, y: 0},
      });
      commitSelection(_ => appendTo);
    }

    if (e.button === 0) {
      // left mouse button
      const uid = e.target?.dataset.uid;
      const parts = new Parts(e.target?.dataset.parts?.split(' ').filter((p:string) => p!=="") || []);
      if (uid && parts.size > 0) {
        // mouse hovers over a shape or part of a shape
        const allPartsInSelection = selection.get(uid)?.difference(parts).size === 0;
        if (!allPartsInSelection) {
          // existing selection does not (entirely) cover the part
          if (e.target.classList.contains("helper")) {
            // it's only a helper
            // -> update selection by the part and start dragging it
            commitSelection(() => new Selection([
              ...appendTo,
              [uid, parts],
            ]));
            setDragging(true);
          }
          else {
            // it's an actual shape
            // (we treat shapes differently from helpers because in a big hierarchical model it is nearly impossible to click anywhere without clicking inside a shape)
            startMakingSelection();
          }
        }
        else {
          // the part is in existing selection
          // -> just start dragging
          commitSelection(s => s); // <-- but also create an undo-checkpoint!
          setDragging(true);
        }
      }
      else {
        // mouse is not on any shape
        startMakingSelection();
      }
    }
    else {
      // any other mouse button (e.g., middle mouse button)
      // -> just start making a selection
      startMakingSelection();
    }
  }, [commitState, commitSelection, getCurrentPointer, insertMode, selection, shiftOrCtrlPressed]);

  const [cursorPos, setCursorPos] = useState<Vec2D>({x:0,y:0});

  const onMouseMove = useCallback((e: {pageX: number, pageY: number, movementX: number, movementY: number}) => {
    const currentPointer = getCurrentPointer(e);
    setCursorPos(currentPointer);
    if (dragging) {
      // we're moving / resizing
      // ALL possible manipulation (besides rotation) happens here
      const pointerDelta = {x: e.movementX/zoom, y: e.movementY/zoom};
      const getParts = (uid: string) => {
          return selection.get(uid) || new Parts();
      }
      replaceState(state => ({
        ...state,
        rountangles: state.rountangles.map(r => {
          const selectedParts = getParts(r.uid);
          if (selectedParts.size === 0) {
            return r;
          }
          return {
            ...r,
            ...roundRect2D(transformRect(r, selectedParts, pointerDelta)),
          };
        })
        .toSorted((a,b) => area(b) - area(a)), // sort: smaller rountangles are drawn on top
        diamonds: state.diamonds.map(d => {
          const selectedParts = getParts(d.uid);
          if (selectedParts.size === 0) {
            return d;
          }
          return {
            ...d,
            ...roundRect2D(transformRect(d, selectedParts, pointerDelta)),
          };
        }),
        history: state.history.map(h => {
          const selectedParts = getParts(h.uid);
          if (selectedParts.size === 0) {
            return h;
          }
          return {
            ...h,
            topLeft: roundVec2D(addV2D(h.topLeft, pointerDelta)),
          }
        }),
        arrows: state.arrows.map(a => {
          const selectedParts = getParts(a.uid);
          if (selectedParts.size === 0) {
            return a;
          }
          return {
            ...a,
            ...roundLine2D(transformLine(a, selectedParts, pointerDelta)),
          }
        }),
        texts: state.texts.map(t => {
          const selectedParts = getParts(t.uid);
          if (selectedParts.size === 0) {
            return t;
          }
          return {
            ...t,
            topLeft: roundVec2D(addV2D(t.topLeft, pointerDelta)),
          }
        }).toSorted((a,b) => a.topLeft.y - b.topLeft.y),
      }));
      setDragging(true);
    }
    else if (selectingState) {
      // we're making a selection
      setSelectingState(ss => {
        const selectionSize = subtractV2D(currentPointer, ss!.topLeft);
        return {
          ...ss!,
          size: selectionSize,
        };
      });
    }
  }, [replaceState, getCurrentPointer, selectingState, setSelectingState, selection, dragging]);

  const onMouseUp = useCallback((e: {target: any, pageX: number, pageY: number}) => {
    if (dragging) {
      // we were moving / resizing
      setDragging(false);

      // do not persist sizes smaller than 40x40
      replaceState(state => {
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
      // we were making a selection
      if (selectingState.size.x === 0 && selectingState.size.y === 0) {
        // it was only a click (mouse didn't move)
        // -> select the clicked part(s)
        // (btw, this is only here to allow selecting rountangles by clicking inside them, all other shapes can be selected entirely by their 'helpers')
        const uid = e.target?.dataset.uid;
        if (uid) {
          const parts = new Parts(e.target?.dataset.parts.split(' ').filter((p: string) => p!=="") || []);
          if (uid) {
            replaceSelection(oldSelection => new Selection([
              ...oldSelection,
              [uid, parts],
            ]));
          }
        }
      }
      else {
        // complete selection
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
        
        replaceSelection(oldSelection => {
          return new Selection([...oldSelection, ...newSelection]);
        });
      }
    }
    setSelectingState(null); // no longer making a selection
  }, [replaceState, replaceSelection, dragging, selectingState, setSelectingState, refSVG.current]);

  const trackShiftKey = useCallback((e: KeyboardEvent) => {
    setShiftOrCtrlPressed(e.shiftKey || e.ctrlKey);
  }, []);

  const onSelectAll = useCallback(() => {
    setDragging(false);
    commitState(state => ({
      ...state,
      selection: new Selection([
        ...state.rountangles.map(r => [r.uid, allRectParts] as const),
        ...state.diamonds.map(d => [d.uid, allRectParts] as const),
        ...state.arrows.map(a => [a.uid, allArrowParts] as const),
        ...state.texts.map(t => [t.uid, allTextParts] as const),
        ...state.history.map(h => [h.uid, allHistoryParts] as const),
      ]),
    }));
  }, [commitState, setDragging]);

  const convertSelection = useCallback((kind: "or"|"and") => {
    commitState(state => ({
      ...state,
      rountangles: state.rountangles.map(r => state.selection.has(r.uid) ? ({...r, kind}) : r),
    }));
  }, [commitState]);

  useShortcuts([
    {keys: ["o"], action: useCallback(() => convertSelection("or"), [convertSelection])},
    {keys: ["a"], action: useCallback(() => convertSelection("and"), [convertSelection])},
    {keys: ["Ctrl", "a"], action: onSelectAll},
  ]);

  useEffect(() => {
    // mousemove and mouseup are global event handlers so they keep working when pointer is outside of browser window
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", trackShiftKey);
    window.addEventListener("keyup", trackShiftKey);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", trackShiftKey);
      window.removeEventListener("keyup", trackShiftKey);
    };
  }, [selectingState, dragging]);

  return {onMouseDown, selectionRect: selectingState && <Selecting {...selectingState} />, newSelection, dragging, setDragging, cursorPos};
}
