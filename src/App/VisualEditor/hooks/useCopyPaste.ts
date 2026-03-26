import { useShortcuts } from "@/hooks/useShortcuts";
import { allArrowParts, allHistoryParts, allRectParts, allTextParts, Arrow, ConcreteSyntax, Diamond, entirelySelectedShapes, History, Rountangle, shapesBBox, Text } from "@/statecharts/concrete_syntax";
import { addV2D, area, centerOf, subtractV2D, Vec2D } from "@/util/geometry";
import { ClipboardEvent, Dispatch, useCallback, useMemo } from "react";
import { Selection, VisualEditorState } from "../VisualEditor.state";

export type CopyPasteCallbacks = {
  onCopy: () => void;
  onPaste: () => void;
  onCut: () => void;
  deleteSelection: () => void;
}

export const copySelection = (state: VisualEditorState, selection: Selection) => {
  return JSON.stringify(entirelySelectedShapes(state, selection));
};

const copyInternal = (state: VisualEditorState, selection: Selection, e: ClipboardEvent) => {
  const data = copySelection(state, selection);
  e.clipboardData?.setData("text/plain", data);
};

export const pasteData = (data: string, where: Vec2D, setState: Dispatch<(v:VisualEditorState) => VisualEditorState>, onSuccess: () => void) => {
  if (data) {
    try {
      const parsed: ConcreteSyntax = JSON.parse(data);
      // move the pasted shapes such that the center of their bounding box is at the cursor's position
      const bbox = shapesBBox(parsed);
      const center = centerOf(bbox!);
      const offset = subtractV2D(where, center);
      setState(state => {
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
          onSuccess();
          return {
            ...state,
            rountangles: [...state.rountangles, ...copiedRountangles].sort((a,b) => area(b)-area(a)),
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
    }
    catch (e) {
      console.warn("error pasting data. most likely you're tying to paste nonsense. ", e);
    }
  }
}


const pasteWhere = {x: 500, y: 100};
export function useCopyPaste(state: VisualEditorState, commit: Dispatch<(v:VisualEditorState) => VisualEditorState>, selection: Selection, startDragging: (where: Vec2D) => void) {


  const onPaste = useCallback((e: ClipboardEvent) => {
    console.log('paste...');
    const data = e.clipboardData?.getData("text/plain");
    pasteData(data, pasteWhere, commit, () => {
      e.preventDefault();
      startDragging(pasteWhere);
    });
  }, [commit, startDragging]);

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
    commit(state => {
      const es = entirelySelectedShapes(state, state.selection);
      return {
        ...state,
        rountangles: state.rountangles.filter(y => !es.rountangles.some(x => x.uid === y.uid)),
        diamonds: state.diamonds.filter(y => ! es.diamonds.some(x => x.uid === y.uid)),
        history: state.history.filter(y => ! es.history.some(x => x.uid === y.uid)),
        arrows: state.arrows.filter(y => ! es.arrows.some(x => x.uid === y.uid)),
        texts: state.texts.filter(y => ! es.texts.some(x => x.uid === y.uid)),
        selection: new Selection([...state.selection].filter(([uid]) =>
            !Object.values(es).some(s => s.some(s => s.uid === uid)))),
      };
    });
  }, [commit]);

  useShortcuts([
    {keys: ["Delete"], action: deleteSelection},
  ])

  return useMemo(() => ({
    onCopy, onPaste, onCut, deleteSelection,
  }), [onCopy, onPaste, onCut, deleteSelection]) as CopyPasteCallbacks;
}
