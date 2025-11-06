import { Arrow, Diamond, Rountangle, Text, History } from "@/statecharts/concrete_syntax";
import { ClipboardEvent, Dispatch, SetStateAction, useCallback, useEffect } from "react";
import { Selection, VisualEditorState } from "./VisualEditor";
import { addV2D } from "@/util/geometry";

// const offset = {x: 40, y: 40};
const offset = {x: 0, y: 0};

export function useCopyPaste(makeCheckPoint: () => void, state: VisualEditorState, setState: Dispatch<(v:VisualEditorState) => VisualEditorState>, selection: Selection) {
  const onPaste = useCallback((e: ClipboardEvent) => {
    const data = e.clipboardData?.getData("text/plain");
    if (data) {
      try {
        const parsed = JSON.parse(data);
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
            // @ts-ignore
            const newSelection: Selection = [
              ...copiedRountangles.map(r => ({uid: r.uid, parts: ["left", "top", "right", "bottom"]})),
              ...copiedDiamonds.map(d => ({uid: d.uid, parts: ["left", "top", "right", "bottom"]})),
              ...copiedArrows.map(a => ({uid: a.uid, parts: ["start", "end"]})),
              ...copiedTexts.map(t => ({uid: t.uid, parts: ["text"]})),
              ...copiedHistories.map(h => ({uid: h.uid, parts: ["history"]})),
            ];
            makeCheckPoint();
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
  }, [setState]);

  const copyInternal = useCallback((state: VisualEditorState, selection: Selection, e: ClipboardEvent) => {
    const uidsToCopy = new Set(selection.map(shape => shape.uid));
    const rountanglesToCopy = state.rountangles.filter(r => uidsToCopy.has(r.uid));
    const diamondsToCopy = state.diamonds.filter(d => uidsToCopy.has(d.uid));
    const historiesToCopy = state.history.filter(h => uidsToCopy.has(h.uid));
    const arrowsToCopy = state.arrows.filter(a => uidsToCopy.has(a.uid));
    const textsToCopy = state.texts.filter(t => uidsToCopy.has(t.uid));
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
    setState(state => ({
      ...state,
      rountangles: state.rountangles.filter(r => !state.selection.some(rs => rs.uid === r.uid)),
      diamonds: state.diamonds.filter(d => !state.selection.some(ds => ds.uid === d.uid)),
      history: state.history.filter(h => !state.selection.some(hs => hs.uid === h.uid)),
      arrows: state.arrows.filter(a => !state.selection.some(as => as.uid === a.uid)),
      texts: state.texts.filter(t => !state.selection.some(ts => ts.uid === t.uid)),
      selection: [],
    }));
  }, [setState]);

  const onKeyDown = (e: KeyboardEvent) => {
    // @ts-ignore
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
    if (e.key === "Delete") {
      // delete selection
      makeCheckPoint();
      deleteSelection();
      e.preventDefault();
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  })

  return {onCopy, onPaste, onCut, deleteSelection};
}