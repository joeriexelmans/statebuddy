import { Arrow, Diamond, Rountangle, Text, History } from "@/statecharts/concrete_syntax";
import { ClipboardEvent, Dispatch, SetStateAction, useCallback, useEffect } from "react";
import { Selection, VisualEditorState } from "../VisualEditor";
import { addV2D } from "@/util/geometry";
import { useShortcuts } from "@/hooks/useShortcuts";

// const offset = {x: 40, y: 40};
const offset = {x: 0, y: 0};

function uidsToParts(selection: Selection) {
  const partCount = new Map<string, Set<string>>();
  for (const {uid, part} of selection) {
    partCount.set(uid, (partCount.get(uid) || new Set()).add(part));
  }
  return partCount;
}

export function useCopyPaste(state: VisualEditorState, commitState: Dispatch<(v:VisualEditorState) => VisualEditorState>, selection: Selection) {
  const onPaste = useCallback((e: ClipboardEvent) => {
    const data = e.clipboardData?.getData("text/plain");
    if (data) {
      try {
        const parsed = JSON.parse(data);
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
            // @ts-ignore
            const newSelection: Selection = [
              ...copiedRountangles.flatMap(r => ["left", "top", "right", "bottom"].map(part => ({uid: r.uid, part}))),
              ...copiedDiamonds.flatMap(d => ["left", "top", "right", "bottom"].map(part => ({uid: d.uid, part}))),
              ...copiedArrows.flatMap(a => ["start", "end"].map(part => ({uid: a.uid, part}))),
              ...copiedTexts.map(t => ({uid: t.uid, part: "text"})),
              ...copiedHistories.map(h => ({uid: h.uid, part: ["history"]})),
            ];
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
      }
      catch (e) {
        console.warn("error pasting data. most likely you're tying to paste nonsense. ", e);
      }
      e.preventDefault();
    }
  }, [commitState]);

  const copyInternal = useCallback((state: VisualEditorState, selection: Selection, e: ClipboardEvent) => {
    const uidsToCopy = new Set(selection.map(shape => shape.uid));
    const m = uidsToParts(selection);
    
    // only copy shapes that are wholy selected:
    const rountanglesToCopy = state.rountangles.filter(r => m.get(r.uid)?.size === 4);
    const diamondsToCopy = state.diamonds.filter(d => m.get(d.uid)?.size === 4);
    const historiesToCopy = state.history.filter(h => m.get(h.uid)?.size === 1);
    const arrowsToCopy = state.arrows.filter(a => m.get(a.uid)?.size === 2);
    const textsToCopy = state.texts.filter(t => m.get(t.uid)?.size === 1);

    e.clipboardData?.setData("text/plain", JSON.stringify({
      rountangles: rountanglesToCopy,
      diamonds: diamondsToCopy,
      history: historiesToCopy,
      arrows: arrowsToCopy,
      texts: textsToCopy,
    }));
  }, []);

  const onCopy = useCallback((e: ClipboardEvent) => {
    if (selection.length > 0) {
      e.preventDefault();
      copyInternal(state, selection, e);
    }
  }, [state, selection]);

  const onCut = useCallback((e: ClipboardEvent) => {
    if (selection.length > 0) {
      copyInternal(state, selection, e);
      deleteSelection();
      e.preventDefault();
    }
  }, [state, selection]);

  const deleteSelection = useCallback(() => {
    commitState(state => ({
      ...state,
      rountangles: state.rountangles.filter(r => !state.selection.some(rs => rs.uid === r.uid)),
      diamonds: state.diamonds.filter(d => !state.selection.some(ds => ds.uid === d.uid)),
      history: state.history.filter(h => !state.selection.some(hs => hs.uid === h.uid)),
      arrows: state.arrows.filter(a => !state.selection.some(as => as.uid === a.uid)),
      texts: state.texts.filter(t => !state.selection.some(ts => ts.uid === t.uid)),
      selection: [],
    }));
  }, [commitState]);

  useShortcuts([
    {keys: ["Delete"], action: deleteSelection},
  ])

  return {onCopy, onPaste, onCut, deleteSelection};
}