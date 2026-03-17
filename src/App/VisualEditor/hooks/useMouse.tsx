import { allArrowParts, allHistoryParts, allRectParts, allTextParts, rountangleMinSize } from "@/statecharts/concrete_syntax";
import { addV2D, area, isEntirelyWithin, normalizeRect, Rect2D, roundLine2D, roundRect2D, roundVec2D, scaleV2D, subtractV2D, transformLine, transformRect, Vec2D } from "@/util/geometry";
import { getBBoxInSvgCoords } from "@/util/svg_helper";
import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MIN_ROUNTANGLE_SIZE } from "../../parameters";
import { ToolMode, ToolSelectState } from "../../TopPanel/Toolbars/ToolSelect";
import { SelectingState } from "../Selection";
import { useShortcuts } from "@/hooks/useShortcuts";
import styles from "../VisualEditor.module.css";
import { CopyPasteCallbacks, useCopyPaste } from "./useCopyPaste";
import { VisualEditorState, Parts } from "../VisualEditor.state";
import { Selection } from "../VisualEditor.state";
import { EditHistoryCallbacks } from "@/App/hooks/useEditHistory";
import { useDetectChange, useDetectChange2 } from "@/hooks/useDetectChange";

export type EditorStuff = {
  onMouseDown: (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => void;
  dragging: Vec2D | null;
  setDragging: Dispatch<SetStateAction<Vec2D | null>>;
  cursorPos: Vec2D;
  refSVG: RefObject<SVGSVGElement | null>;
  copyPasteCallbacks: CopyPasteCallbacks;

  newSelection: Selection;
  selectingState: SelectingState;
  renderSelection: Selection,
};

export function useMouse(
  mouseMap: ToolSelectState,
  zoom: number,
  
  // set of currently selected shapes
  // selection: Selection,
  state: VisualEditorState,
  
  historyCallbacks: EditHistoryCallbacks,
) {
  // Not null while the user is making a selection (rendered as a transparent dashed-border blue box).
  const [selectingState, setSelectingState] = useState<SelectingState>(null);
  
  // Whether a bunch of selected shapes are being dragged with the mouse cursor.
  // if not dragging: null
  // if dragging: position of cursor at last mouse event
  const [dragging, setDragging] = useState<Vec2D|null>(null);
  
  // The last known cursor position (via the most recent mouse event).
  // Needed for pasting from clipboard (insert shapes under cursor).
  const [cursorPos, setCursorPos] = useState<Vec2D>({x:0,y:0});
  
  // We keep a ref to the SVG element in order to transform mouse event coordinates to SVG coordinates.
  const refSVG = useRef<SVGSVGElement>(null);
  
  const {commitState, replaceState} = historyCallbacks;
  
  // The set of selected shapes is part of the editor state (and its history)
  // This callback creates a new entry in edit history with the updated selection.
  const commitSelection = useCallback((cb: (oldSelection: Selection) => Selection) => {
    commitState(oldState => ({...oldState, selection: cb(oldState.selection)}));
  },[commitState]);
  
  // This callback overwrites the last entry in edit history with the updated selection.
  const replaceSelection = useCallback((cb: (oldSelection: Selection) => Selection) =>
    replaceState(oldState => ({...oldState, selection: cb(oldState.selection)})),[replaceState]);
  
  // The shapes being currently selected.
  // The shapes in this selection are also rendered as selected. But we keep them seperate in case the user decides to cancel the making of the new selection.
  const newSelection: Selection = useMemo(() =>
    computeSelection(selectingState, refSVG, zoom),
  [selectingState, refSVG, zoom]);
  
  // Helper to convert mouse event coordinates to SVG coordinates.
  const getCurrentPointer = useCallback((e: {pageX: number, pageY: number}) => {
    if (refSVG.current) {
      const bbox = refSVG.current.getBoundingClientRect();
      return {
        x: (e.pageX - bbox.left) / zoom,
        y: (e.pageY - bbox.top) / zoom,
      }
    }
    else {
      return {x: 0, y: 0};
    }
  }, [refSVG.current, zoom]);
  
  
  const startSelect = useCallback((e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const currentPointer = getCurrentPointer(e);
    let toGrow: Selection;
    // Shift or Ctrl key down: grow existing selection.
    if (e.getModifierState("Shift") || e.getModifierState("Control")) {
      toGrow = state.selection;
    }
    else {
      toGrow = new Selection();
    }
    const startMakingSelection = () => {
      setDragging(null);
      setSelectingState({
        topLeft: currentPointer,
        size: {x: 0, y: 0},
      });
      commitSelection(_ => toGrow);
    }
    // left mouse button
    const [uid, parts, isHelper] = eventTargetToParts(e.target);
    if (uid && parts.size > 0) {
      // mouse hovers over a shape or part of a shape
      const allPartsInSelection = parts.difference(state.selection.get(uid) || new Set()).size === 0;
      if (!allPartsInSelection) {
        // existing selection does not (entirely) cover the part
        if (isHelper) {
          // it's only a helper
          // -> update selection by the part and start dragging it
          commitSelection(() => new Selection([
            ...toGrow,
            [uid, (toGrow.get(uid) || new Set()).union(parts)],
          ]));
          setDragging(currentPointer);
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
        setDragging(currentPointer);
      }
    }
    else {
      // mouse is not on any shape
      startMakingSelection();
    }
  }, [getCurrentPointer, commitSelection, state.selection]);
  
  const startInsert = useCallback((e: React.MouseEvent<SVGSVGElement, MouseEvent>, mode: ToolMode) => {
    const currentPointer = getCurrentPointer(e);
    // ignore selection, right mouse button always inserts
    commitState(state => {
      const newID = state.nextID.toString();
      if (mode === "and" || mode === "or") {
        // insert rountangle
        return {
          ...state,
          rountangles: [...state.rountangles, {
            uid: newID,
            topLeft: currentPointer,
            size: MIN_ROUNTANGLE_SIZE,
            kind: mode,
          }],
          nextID: state.nextID+1,
          selection: new Selection([[newID, new Parts(["bottom", "right"])]]),
        };
      }
      else if (mode === "pseudo") {
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
      else if (mode === "shallow" || mode === "deep") {
        return {
          ...state,
          history: [...state.history, {
            uid: newID,
            kind: mode,
            topLeft: currentPointer,
          }],
          nextID: state.nextID+1,
          selection: new Selection([[newID, new Parts(["history"])]]),
        }
      }
      else if (mode === "transition") {
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
      else if (mode === "text") {
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
      throw new Error("unreachable, mode=" + mode); // shut up typescript
    });
    // The user can still resize/move the inserted shape as long as the insert mouse button is kept pressed:
    setDragging(currentPointer);
    return;
  }, [getCurrentPointer, commitState]);
  
  const modeToAction = useCallback((mode: ToolMode, e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (mode === "nothing") {
      // In this case, we very consciously don't preventDefault so the browser's context menu can still be accessed with right mouse button if no tool is mapped to that button -> useful for debugging!
      return;
    }
    else if (mode === "select") {
      e.preventDefault();
      e.stopPropagation();
      startSelect(e);
    }
    else {
      e.preventDefault();
      e.stopPropagation();
      startInsert(e, mode);
    }
  }, [startSelect, startInsert]);
  
  const onMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (e.button === 0) {
      modeToAction(mouseMap.leftMouseMode, e);
    }
    else if (e.button === 1) {
      modeToAction(mouseMap.middleMouseMode, e);
    }
    else if (e.button === 2) {
      modeToAction(mouseMap.rightMouseMode, e);
    }
  }, [modeToAction, mouseMap]);
  
  const onMouseMove = useCallback((e: {pageX: number, pageY: number}) => {
    const currentPointer = getCurrentPointer(e);
    setCursorPos(currentPointer);
    setDragging(prevPointer => {
      if (prevPointer) {
        // user was dragging / resizing
        const pointerDelta = subtractV2D(currentPointer, prevPointer);
        // update state in next event cycle ()
        setTimeout(() => { // <-- bit hacky, but React complains if we call replaceState directly.
          replaceState(state => drag(state, pointerDelta));
        });
        return currentPointer;
      }
      return null;
    })
    setSelectingState(ss => {
      if (ss) {
        const selectionSize = subtractV2D(currentPointer, ss!.topLeft);
        return {
          ...ss!,
          size: selectionSize,
        };
      }
      return ss;
    });
  }, [replaceState, getCurrentPointer, setSelectingState, dragging, setDragging]);

  // useDetectChange2({replaceState, getCurrentPointer, setSelectingState, selection: state.selection, dragging, setDragging});
  
  const onMouseUp = useCallback((e: {target: any, pageX: number, pageY: number}) => {
    if (dragging) {
      // we were moving / resizing
      setDragging(null);
      
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
    setSelectingState(selectingState => {
      if (selectingState) {
        // we were making a selection
        if (selectingState.size.x === 0 && selectingState.size.y === 0) {
          // it was only a click (mouse didn't move)
          // -> select the clicked part(s)
          // (btw, this is only here to allow selecting rountangles by clicking inside them, all other shapes can be selected entirely by their 'helpers')
          const [uid, parts] = eventTargetToParts(e.target);
          if (uid) {
            if (uid) {
              replaceSelection(oldSelection => new Selection([
                ...oldSelection,
                [uid, (oldSelection.get(uid) || new Set()).union(parts)],
              ]));
            }
          }
        }
        else {
          replaceSelection(oldSelection => mergeSelections(oldSelection, newSelection));
        }
      }
      return null;
    })
    // setSelectingState(null); // no longer making a selection
  }, [replaceState, replaceSelection, dragging, setSelectingState, refSVG.current]);

  const onSelectAll = useCallback(() => {
    setDragging(null);
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
  
  
  
  const renderSelection = useMemo(() => mergeSelections(state.selection, newSelection), [state.selection, newSelection]);
  
  // copy/paste depends on 'useMouse' (it updates the 'dragging' state on paste)
  const copyPasteCallbacks = useCopyPaste(
    state,
    commitState,
    renderSelection,
    () => setDragging(cursorPos), // <-- upon pasting, the pasted shapes follow the mouse cursor until the user clicks at the desired position.
    cursorPos);
    
    useShortcuts([
      {keys: ["o"], action: useCallback(() => convertSelection("or"), [convertSelection])},
      {keys: ["a"], action: useCallback(() => convertSelection("and"), [convertSelection])},
      {keys: ["Ctrl", "a"], action: onSelectAll},
    ]);
    
    useEffect(() => {
      console.log('registering mouse handlers');
      // mousemove and mouseup are registered on the window object (i.e., globally) so they keep working when pointer is outside of browser window.
      // mousedown will be registered on the SVG element.
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("mousemove", onMouseMove);
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
    }, [onMouseUp, onMouseMove]);
    
    return {
      onMouseDown,
      dragging,
      setDragging,
      cursorPos,
      refSVG,
      copyPasteCallbacks,

      newSelection,
      selectingState,
      renderSelection,
    };
  }
  
  
  export function mergeSelections(a: Selection, b: Selection) {
    const result = new Selection(a);
    for (const [uid, parts] of b.entries()) {
      result.set(uid, (result.get(uid) || new Set()).union(parts));
    }
    return result;
  }
  
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
      }).filter(el => !el.classList.contains(styles.corner)); // <-- remove corner elements because they mess up the selection
      
      const selection: Selection = new Selection();
      for (const shape of shapesInSelection) {
        const [uid, parts] = eventTargetToParts(shape);
        if (uid) {
          for (const part of parts) {
            selection.set(uid, (selection.get(uid) as Parts || new Parts()).add(part));
          }
        }
      }
      return selection;
    }
    return new Selection();
  }
  
  function drag(state: VisualEditorState, pointerDelta: Vec2D) {
    const getParts = (uid: string) => {
      return state.selection.get(uid) || new Parts();
    }
    return {
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
    };
  }

  function eventTargetToParts(target: EventTarget|null) {
    while (target) {
      // @ts-ignore: dataset property unknown to TypeScript
      if (target.dataset?.uid) {
        return [
          // @ts-ignore: dataset property unknown to TypeScript
          target.dataset.uid as string,
          // @ts-ignore: dataset property unknown to TypeScript
          new Parts(target.dataset.parts?.split(' ').filter((p:string) => p!=="") || []),
          // @ts-ignore: classList unknown
          target.classList.contains(styles.helper) as boolean,
        ] as const;
      }
      // @ts-ignore
      target = target.parentNode;
    }
    return [undefined, new Parts(), false] as const;
  }