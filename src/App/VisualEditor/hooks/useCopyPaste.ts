import { Arrow, Diamond, Rountangle, Text, History, allRectParts, allArrowParts, allTextParts, allHistoryParts, ConcreteSyntax, shapesBBox, entirelySelectedShapes } from "@/statecharts/concrete_syntax";
import { ClipboardEvent, Dispatch, useCallback } from "react";
import { Selection, VisualEditorState } from "../VisualEditor";
import { addV2D, centerOf, subtractV2D, Vec2D } from "@/util/geometry";
import { useShortcuts } from "@/hooks/useShortcuts";

export function useCopyPaste(state: VisualEditorState, commitState: Dispatch<(v:VisualEditorState) => VisualEditorState>, selection: Selection, startDragging: () => void, cursorPos: Vec2D) {
  const onPaste = useCallback((e: ClipboardEvent) => {
    console.log('paste...');
    const data = e.clipboardData?.getData("text/plain");
    if (data) {
      try {
        const parsed: ConcreteSyntax = JSON.parse(data);
        // move the pasted shapes such that the center of their bounding box is at the cursor's position
        const bbox = shapesBBox(parsed);
        const center = centerOf(bbox!);
        const offset = subtractV2D(cursorPos, center);
        commitState(state => {
          try {
            let nextID = state.nextID;
            const copiedRountangles: Rountangle[] = parsed.rountangles.map((r: Rountangle) => ({
              ...r,
              uid: (nextID++).toString(),
              topLeft: addV2D(r.topLeft, offset),
            } as Rountangle));
            const copiedDiamonds: Diamond[] = parsed.diamonds.map((r: Diamond) => ({
              ...r,
              uid: (nextID++).toString(),
              topLeft: addV2D(r.topLeft, offset),
            } as Diamond));
            const copiedArrows: Arrow[] = parsed.arrows.map((a: Arrow) => ({
              ...a,
              uid: (nextID++).toString(),
              start: addV2D(a.start, offset),
              end: addV2D(a.end, offset),
            } as Arrow));
            const copiedTexts: Text[] = parsed.texts.map((t: Text) => ({
              ...t,
              uid: (nextID++).toString(),
              topLeft: addV2D(t.topLeft, offset),
            } as Text));
            const copiedHistories: History[] = parsed.history.map((h: History) => ({
              ...h,
              uid: (nextID++).toString(),
              topLeft: addV2D(h.topLeft, offset),
            }))
            const newSelection = new Selection([
              ...copiedRountangles.map(r => [r.uid, allRectParts] as const),
              ...copiedDiamonds.map(d => [d.uid, allRectParts] as const),
              ...copiedArrows.map(a => [a.uid, allArrowParts] as const),
              ...copiedTexts.map(t => [t.uid, allTextParts] as const),
              ...copiedHistories.map(h => [h.uid, allHistoryParts] as const),
            ]);
            return {
              ...state,
              rountangles: [...state.rountangles, ...copiedRountangles],
              diamonds: [...state.diamonds, ...copiedDiamonds],
              arrows: [...state.arrows, ...copiedArrows],
              texts: [...state.texts, ...copiedTexts],
              history: [...state.history, ...copiedHistories],
              nextID: nextID,
              selection: newSelection,
            };
          }
          catch (e) {
            console.warn("error pasting data. most likely you're tying to paste nonsense. ", e);
            return state;
          }
        });
        startDragging();
      }
      catch (e) {
        console.warn("error pasting data. most likely you're tying to paste nonsense. ", e);
      }
      e.preventDefault();
    }
  }, [commitState, startDragging, cursorPos]);

  const copyInternal = useCallback((state: VisualEditorState, selection: Selection, e: ClipboardEvent) => {
    e.clipboardData?.setData("text/plain",
      JSON.stringify(
        entirelySelectedShapes(state, selection)));
  }, []);

  const onCopy = useCallback((e: ClipboardEvent) => {
    console.log('copy...');
    if (selection.size > 0) {
      console.log('copy', selection.size, 'shapes...');
      e.preventDefault();
      copyInternal(state, selection, e);
    }
  }, [state, selection]);

  const onCut = useCallback((e: ClipboardEvent) => {
    if (selection.size > 0) {
      copyInternal(state, selection, e);
      deleteSelection();
      e.preventDefault();
    }
  }, [state, selection]);

  const deleteSelection = useCallback(() => {
    commitState(state => ({
      ...state,
      rountangles: state.rountangles.filter(r => !state.selection.has(r.uid)),
      diamonds: state.diamonds.filter(d => !state.selection.has(d.uid)),
      history: state.history.filter(h => !state.selection.has(h.uid)),
      arrows: state.arrows.filter(a => !state.selection.has(a.uid)),
      texts: state.texts.filter(t => !state.selection.has(t.uid)),
      selection: new Selection(),
    }));
  }, [commitState]);

  useShortcuts([
    {keys: ["Delete"], action: deleteSelection},
  ])

  return {onCopy, onPaste, onCut, deleteSelection};
}