import { ToolMode, ToolSelectState } from "@/App/migrations/v1_types";
import { useShortcuts } from "@/hooks/useShortcuts";
import { UndoCallbacks } from "@/hooks/useUndo";
import { allArrowParts, allHistoryParts, allRectParts, allTextParts, rectMinimumSize } from "@/languages/statecharts/concrete_syntax";
import { isEntirelyWithin, normalizeRect, Rect2D, scaleV2D, subtractV2D, Vec2D } from "@/util/geometry";
import { getBBoxInSvgCoords } from "@/util/svg_helper";
import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeepSetter } from "../../../util/partial_setter";
import { MIN_ROUNTANGLE_SIZE } from "../../parameters";
import { mergeSelections, SelectingState } from "../Selection";
import { translateSelection } from "../transformations/translate";
import styles from "../VisualEditor.module.css";
import { Parts, Selection, VisualEditorState } from "../VisualEditor.state";
import { CopyPasteCallbacks, pasteData, useCopyPaste } from "./useCopyPaste";
import { PasteCallback } from "@/App/TopPanel/Toolbars/Editor/CopyPasteButtons";

export type EditorStuff = {
  onMouseDown: (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => void;
  action: EditorAction;
  paste: PasteCallback;
  refSVG: RefObject<SVGSVGElement | null>;
  refScroll: RefObject<HTMLDivElement | null>;
  copyPasteCallbacks: CopyPasteCallbacks;
  newSelection: Selection;
  renderSelection: Selection,
};

export type EditorAction = 
  {what: "nothing"} |
  {what: "dragging", ptr: Vec2D} |
  {what: "panning", ptr: Vec2D};

// the stateful part of the VisualEditor
export function useEditor(
  mouseMap: ToolSelectState,
  setMouseMap: DeepSetter<ToolSelectState>,
  zoomPercentage: number,
  state: VisualEditorState,
  setState: DeepSetter<VisualEditorState>,
  historyCallbacks: UndoCallbacks<VisualEditorState>,
  beginEditText: (uid: string) => void,
) {
  const zoom = zoomPercentage / 100;
  
  // Not null while the user is making a selection (rendered as a transparent dashed-border blue box).
  const setMakingSelection = setState.setMakingSelection as Dispatch<SetStateAction<Rect2D|undefined>>;
  
  const [action, setAction] = useState<EditorAction>({what: "nothing"});
  
  // The last known cursor position (via the most recent mouse event).
  // Needed for pasting from clipboard (insert shapes under cursor).
  // const [cursorPos, setCursorPos] = useState<Vec2D>({x:0,y:0});
  
  // We keep a ref to the SVG element in order to transform mouse event coordinates to SVG coordinates.
  const refSVG = useRef<SVGSVGElement>(null);
  const refScroll = useRef<HTMLDivElement>(null);
  
  const {commit, replace} = historyCallbacks;
  
  // The set of selected shapes is part of the editor state (and its history)
  // This callback creates a new entry in edit history with the updated selection.
  const commitSelection = useCallback((cb: (oldSelection: Selection) => Selection) => {
    commit(oldState => ({...oldState, selection: cb(oldState.selection)}));
  },[commit]);
  
  // // This callback overwrites the last entry in edit history with the updated selection.
  // const replaceSelection = useCallback((cb: (oldSelection: Selection) => Selection) =>
  //   replace(oldState => ({...oldState, selection: cb(oldState.selection)})),[replace]);
  
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
  
  
  const startSelectOrMove = useCallback((e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
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
      setAction({what: "nothing"});
      commitSelection(_ => toGrow);
      setMakingSelection({
        topLeft: currentPointer,
        size: {x: 0, y: 0},
      });
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
          setAction({what: "dragging", ptr: currentPointer});
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
        setAction({what: "dragging", ptr: currentPointer});
      }
    }
    else {
      // mouse is not on any shape
      startMakingSelection();
    }
  }, [getCurrentPointer, commitSelection, state.selection, setAction, setMakingSelection]);
  
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
    setAction({what: "dragging", ptr: currentPointer});
  }, [getCurrentPointer, commit, setAction]);

  const beginAction = useCallback((mode: ToolMode, setMode: Dispatch<SetStateAction<string>>, e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    // setMode(mode => {
      if (mode === "nothing") {
        // In this case, we very consciously don't preventDefault so the browser's context menu can still be accessed with right mouse button if no tool is mapped to that button -> useful for debugging!
      }
      else if (mode === "select") {
        e.preventDefault();
        e.stopPropagation();
        startSelectOrMove(e);
      }
      else if (mode === "pan") {
        e.preventDefault();
        e.stopPropagation();
        setAction({what: "panning", ptr: getCurrentPointer(e)});
      }
      else {
        e.preventDefault();
        e.stopPropagation();
        startInsert(e, mode as ToolMode);
        setMode("select");
        // return "select";
      }
      // return mode;
    // })
  }, [startSelectOrMove, startInsert, setAction]);

  const attemptCancelCurrentTool = useCallback(() => {
    if (action.what === "dragging" || state.makingSelection) {
      historyCallbacks.undo();
      setAction({what: "nothing"});
      setMakingSelection(undefined);
      return true;
    }
    return false;
  }, [action, setAction, state.makingSelection, historyCallbacks.undo, setMakingSelection]);
  
  const onMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (e.button === 0) {
      beginAction(mouseMap.leftMouseMode, setMouseMap.setLeftMouseMode, e);
    }
    else if (e.button === 1) {
      beginAction(mouseMap.middleMouseMode, setMouseMap.setMiddleMouseMode, e);
    }
    else if (e.button === 2) {
      beginAction(mouseMap.rightMouseMode, setMouseMap.setRightMouseMode, e);
    }
  }, [beginAction, mouseMap, setMouseMap]);

  const onMouseMove = useCallback((e: {pageX: number, pageY: number}) => {
    const currentPointer = getCurrentPointer(e);
    setAction(action => {
      if (action.what !== "nothing") {
        // user was dragging / resizing
        const pointerDelta = subtractV2D(currentPointer, action.ptr);
        // update state in next event cycle ()
        if (action.what === "dragging") {
          setTimeout(() => { // <-- bit hacky, but React complains if we call replace directly.
            replace(state => translateSelection(state, pointerDelta));
          });
          return {...action, ptr: currentPointer};
        }
        else if (action.what === "panning") {
          if (refScroll.current) {
            const left = refScroll.current.scrollLeft - pointerDelta.x;
            const top = refScroll.current.scrollTop - pointerDelta.y;
            refScroll.current?.scroll({
              behavior: "instant",
              left,
              top,
            });
          }
        }
      }
      return action;
    });
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
  }, [replace, getCurrentPointer, setMakingSelection, setAction, refSVG.current]);
  
  const onMouseUp = useCallback((e: {target: any, pageX: number, pageY: number}) => {
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
    setAction({what: "nothing"}); // <-- no longer dragging
  }, [setState._setShallow, setAction, newSelection, mouseMap, setMouseMap]);

  const onSelectAll = useCallback(() => {
    setAction({what: "nothing"});
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
  }, [commit, setAction]);
  
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
    (where: Vec2D) => setAction({what: "dragging", ptr: where}), // <-- upon pasting, the pasted shapes follow the mouse cursor until the user clicks at the desired position.
  );

  const paste: PasteCallback = useCallback((data: string, where: Vec2D) => {
    pasteData(data, where, setState._setShallow, () => {})
  }, []);

  const onEditText = useCallback(() => {
    if (state.selection.size === 1) {
      for (const [uid, parts] of state.selection) {
        if (parts.size === 1) {
          for (const part of parts) {
            if (part === "text") {
              beginEditText(uid);
            }
          }
        }
      }
    }
  }, [state.selection, beginEditText]);
    
  useShortcuts([
    {keys: ["r"], action: useCallback(() => convertSelection("or"), [convertSelection])},
    {keys: ["a"], action: useCallback(() => convertSelection("and"), [convertSelection])},
    {keys: ["Ctrl", "a"], action: onSelectAll},
    {keys: ["Enter"], action: onEditText},
    {keys: ["Escape"], action: attemptCancelCurrentTool},
    // {keys: ["Escape"], action: useCallback(() => set)}
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
  
  return useMemo(() => ({
    onMouseDown,
    action,
    paste,
    refSVG,
    refScroll,
    copyPasteCallbacks,
    newSelection: aboutToSelect,
    renderSelection,
  }), [
    onMouseDown,
    action,
    paste,
    refSVG,
    refScroll,
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
