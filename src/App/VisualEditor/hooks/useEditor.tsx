import { ToolMode, ToolSelectState } from "@/App/migrations/v1_types";
import { useShortcuts } from "@/hooks/useShortcuts";
import { UndoCallbacks } from "@/hooks/useUndo";
import { allArrowParts, allHistoryParts, allRectParts, allTextParts, rountangleMinSize } from "@/statecharts/concrete_syntax";
import { isEntirelyWithin, normalizeRect, Rect2D, scaleV2D, subtractV2D, Vec2D } from "@/util/geometry";
import { getBBoxInSvgCoords } from "@/util/svg_helper";
import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeepSetter } from "../../makePartialSetter";
import { MIN_ROUNTANGLE_SIZE } from "../../parameters";
import { SelectingState } from "../Selection";
import { translateSelection } from "../transformations/translate";
import styles from "../VisualEditor.module.css";
import { Selection, VisualEditorState } from "../VisualEditor.state";
import { CopyPasteCallbacks, useCopyPaste } from "./useCopyPaste";

export type EditorStuff = {
  onMouseDown: (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => void;
  dragging: Vec2D | null;
  setDragging: Dispatch<SetStateAction<Vec2D | null>>;
  refSVG: RefObject<SVGSVGElement | null>;
  copyPasteCallbacks: CopyPasteCallbacks;

  newSelection: Selection;
  renderSelection: Selection,
};

// the stateful part of the VisualEditor
export function useEditor(
  mouseMap: ToolSelectState,
  zoomPercentage: number,
  state: VisualEditorState,
  setState: DeepSetter<VisualEditorState>,
  historyCallbacks: UndoCallbacks<VisualEditorState>,
  beginEdit: (uid: string) => void,
) {
  const zoom = zoomPercentage / 100;
  
  // Not null while the user is making a selection (rendered as a transparent dashed-border blue box).
  const setMakingSelection = setState.setMakingSelection as Dispatch<SetStateAction<Rect2D|undefined>>;
  
  // Whether a bunch of selected shapes are being dragged with the mouse cursor.
  // if not dragging: null
  // if dragging: position of cursor at last mouse event
  const [dragging, setDragging] = useState<Vec2D|null>(null);
  
  // The last known cursor position (via the most recent mouse event).
  // Needed for pasting from clipboard (insert shapes under cursor).
  // const [cursorPos, setCursorPos] = useState<Vec2D>({x:0,y:0});
  
  // We keep a ref to the SVG element in order to transform mouse event coordinates to SVG coordinates.
  const refSVG = useRef<SVGSVGElement>(null);
  
  const {commit, replace} = historyCallbacks;
  
  // The set of selected shapes is part of the editor state (and its history)
  // This callback creates a new entry in edit history with the updated selection.
  const commitSelection = useCallback((cb: (oldSelection: Selection) => Selection) => {
    commit(oldState => ({...oldState, selection: cb(oldState.selection)}));
  },[commit]);
  
  // This callback overwrites the last entry in edit history with the updated selection.
  const replaceSelection = useCallback((cb: (oldSelection: Selection) => Selection) =>
    replace(oldState => ({...oldState, selection: cb(oldState.selection)})),[replace]);
  
  // The shapes being currently selected.
  // The shapes in this selection are also rendered as selected. But we keep them seperate in case the user decides to cancel the making of the new selection.
  const newSelection = useCallback((selectingState: SelectingState) =>
    computeSelection(selectingState, refSVG, zoom),
  [refSVG, zoom]);
  
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
      toGrow = new Map();
    }
    const startMakingSelection = () => {
      setDragging(null);
      setMakingSelection({
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
          commitSelection(() => new Map([
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
    commit(state => {
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
          selection: new Map([[newID, new Set(["bottom", "right"])]]),
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
          selection: new Map([[newID, new Set(["bottom", "right"])]]),
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
          selection: new Map([[newID, new Set(["history"])]]),
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
          selection: new Map([[newID, new Set(["end"])]]),
        }
      }
      else if (mode === "text") {
        return {
          ...state,
          texts: [...state.texts, {
            uid: newID,
            text: "// Double-click or <Enter> to edit",
            topLeft: currentPointer,
          }],
          nextID: state.nextID+1,
          selection: new Map([[newID, new Set(["text"])]]),
        }
      }
      throw new Error("unreachable, mode=" + mode); // shut up typescript
    });
    // The user can still resize/move the inserted shape as long as the insert mouse button is kept pressed:
    setDragging(currentPointer);
    return;
  }, [getCurrentPointer, commit]);
  
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
    setDragging(prevPointer => {
      if (prevPointer) {
        // user was dragging / resizing
        const pointerDelta = subtractV2D(currentPointer, prevPointer);
        // update state in next event cycle ()
        setTimeout(() => { // <-- bit hacky, but React complains if we call replace directly.
          replace(state => translateSelection(state, pointerDelta));
        });
        return currentPointer;
      }
      return null;
    })
    setMakingSelection(ss => {
      if (ss) {
        const selectionSize = subtractV2D(currentPointer, ss!.topLeft);
        return {
          ...ss!,
          size: selectionSize,
        };
      }
      return ss;
    });
  }, [replace, getCurrentPointer, setMakingSelection, setDragging]);
  
  const onMouseUp = useCallback((e: {target: any, pageX: number, pageY: number}) => {
    // do not persist sizes smaller than 40x40
    replace(state => {
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
    setState._setShallow(state => {
      const {selection, makingSelection, ...rest} = state;
      if (makingSelection) {
        // we were making a selection
        if (makingSelection.size.x === 0 && makingSelection.size.y === 0) {
          // it was only a click (mouse didn't move)
          // -> select the clicked part(s)
          // (btw, this is only here to allow selecting rountangles by clicking inside them, all other shapes can be selected entirely by their 'helpers')
          const [uid, parts] = eventTargetToParts(e.target);
          if (uid) {
            if (uid) {
              return {
                selection: new Map([
                  ...selection,
                  [uid, (selection.get(uid) || new Set()).union(parts)],
                ]),
                ...rest,
              }
            }
          }
        }
        else {
          // user made a 'normal' selection:
          return {
            selection: mergeSelections(selection, newSelection(makingSelection)),
            ...rest,
          };
        }
      }
      return {
        selection,
        ...rest,
      };
    });
    setDragging(null); // <-- no longer dragging
  }, [replace, replaceSelection, setDragging, setMakingSelection, refSVG.current, newSelection]);

  const onSelectAll = useCallback(() => {
    setDragging(null);
    commit(state => ({
      ...state,
      selection: new Map([
        ...state.rountangles.map(r => [r.uid, allRectParts] as const),
        ...state.diamonds.map(d => [d.uid, allRectParts] as const),
        ...state.arrows.map(a => [a.uid, allArrowParts] as const),
        ...state.texts.map(t => [t.uid, allTextParts] as const),
        ...state.history.map(h => [h.uid, allHistoryParts] as const),
      ]),
    }));
  }, [commit, setDragging]);
  
  const convertSelection = useCallback((kind: "or"|"and") => {
    commit(state => ({
      ...state,
      rountangles: state.rountangles.map(r => state.selection.has(r.uid) ? ({...r, kind}) : r),
    }));
  }, [commit]);

  const aboutToSelect = useMemo(() => newSelection(state.makingSelection), [state.makingSelection]);
  const renderSelection = useMemo(() => mergeSelections(state.selection, aboutToSelect), [state.selection, newSelection, aboutToSelect]);
  
  // copy/paste depends on 'useMouse' (it updates the 'dragging' state on paste)
  const copyPasteCallbacks = useCopyPaste(
    state,
    commit,
    setDragging, // <-- upon pasting, the pasted shapes follow the mouse cursor until the user clicks at the desired position.
  );

  const onEditText = useCallback(() => {
    replace(state => {
      if (state.selection.size === 1) {
        for (const [uid, parts] of state.selection) {
          if (parts.size === 1) {
            for (const part of parts) {
              if (part === "text") {
                beginEdit(uid);
              }
            }
          }
        }
      }
      // we don't actually change the state:
      return state;
    })
  }, [replace, beginEdit]);
    
  useShortcuts([
    {keys: ["o"], action: useCallback(() => convertSelection("or"), [convertSelection])},
    {keys: ["a"], action: useCallback(() => convertSelection("and"), [convertSelection])},
    {keys: ["Ctrl", "a"], action: onSelectAll},
    {keys: ["Enter"], action: onEditText},
  ]);
    
  useEffect(() => {
    // mousemove and mouseup are registered on the window object (i.e., globally) so they keep working when pointer is outside of browser window.
    // mousedown will be registered on the SVG element.
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseUp, onMouseMove]);

  // useDetectChange2({
  //   onMouseDown,
  //   dragging,
  //   setDragging,
  //   refSVG,
  //   copyPasteCallbacks,
  //   newSelection: ,
  //   selectingState,
  //   renderSelection,
  // });

  
  return useMemo(() => ({
    onMouseDown,
    dragging,
    setDragging,
    refSVG,
    copyPasteCallbacks,
    newSelection: aboutToSelect,
    renderSelection,
  }), [
    onMouseDown,
    dragging,
    setDragging,
    refSVG,
    copyPasteCallbacks,
    aboutToSelect,
    renderSelection,
  ]);
};
    
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
    
    const selection: Selection = new Map();
    for (const shape of shapesInSelection) {
      const [uid, parts] = eventTargetToParts(shape);
      if (uid) {
        for (const part of parts) {
          selection.set(uid, (selection.get(uid) as Set<string> || new Set()).add(part));
        }
      }
    }
    return selection;
  }
  return new Map();
}



function eventTargetToParts(target: EventTarget|null) {
  while (target) {
    // @ts-ignore: dataset property unknown to TypeScript
    if (target.dataset?.uid) {
      return [
        // @ts-ignore: dataset property unknown to TypeScript
        target.dataset.uid as string,
        // @ts-ignore: dataset property unknown to TypeScript
        new Set(target.dataset.parts?.split(' ').filter((p:string) => p!=="") || []) as Parts,
        // @ts-ignore: classList unknown
        target.classList.contains(styles.helper) as boolean,
      ] as const;
    }
    // @ts-ignore
    target = target.parentNode;
  }
  return [undefined, new Set(), false] as const;
}

export function mergeSelections(a: Selection, b: Selection) {
  const result = new Map(a);
  for (const [uid, parts] of b.entries()) {
    result.set(uid, (result.get(uid) || new Set()).union(parts));
  }
  return result;
}
