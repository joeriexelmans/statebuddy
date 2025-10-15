import * as lz4 from "@nick/lz4";
import { Dispatch, SetStateAction, useEffect, useRef, useState, MouseEvent } from "react";

import { Statechart } from "../statecharts/abstract_syntax";
import { Arrow, ArrowPart, Rountangle, RountanglePart, Text, VisualEditorState, emptyState, findNearestArrow, findNearestRountangleSide, findRountangle } from "../statecharts/concrete_syntax";
import { parseStatechart, TraceableError } from "../statecharts/parser";
import { BigStep } from "../statecharts/runtime_types";
import { ArcDirection, Line2D, Rect2D, Vec2D, addV2D, arcDirection, area, getBottomSide, getLeftSide, getRightSide, getTopSide, isEntirelyWithin, normalizeRect, subtractV2D, transformLine, transformRect } from "./geometry";
import { MIN_ROUNTANGLE_SIZE } from "./parameters";
import { getBBoxInSvgCoords } from "./svg_helper";

import "./VisualEditor.css";
import { ArrowSVG } from "./ArrowSVG";
import { RountangleSVG } from "./RountangleSVG";


type DraggingState = {
  lastMousePos: Vec2D;
} | null; // null means: not dragging

type SelectingState = Rect2D | null;

export type RountangleSelectable = {
  // kind: "rountangle";
  parts: RountanglePart[];
  uid: string;
}
type ArrowSelectable = {
  // kind: "arrow";
  parts: ArrowPart[];
  uid: string;
}
type TextSelectable = {
  parts: ["text"];
  uid: string;
}
type Selectable = RountangleSelectable | ArrowSelectable | TextSelectable;
type Selection = Selectable[];

type HistoryState = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

export const sides: [RountanglePart, (r:Rect2D)=>Line2D][] = [
  ["left", getLeftSide],
  ["top", getTopSide],
  ["right", getRightSide],
  ["bottom", getBottomSide],
];

export type InsertMode = "and"|"or"|"pseudo"|"transition"|"text";

type VisualEditorProps = {
  setAST: Dispatch<SetStateAction<Statechart>>,
  rt: BigStep|undefined,
  errors: TraceableError[],
  setErrors: Dispatch<SetStateAction<TraceableError[]>>,
  mode: InsertMode,
};

export function VisualEditor({setAST, rt, errors, setErrors, mode}: VisualEditorProps) {
  const [historyState, setHistoryState] = useState<HistoryState>({current: emptyState, history: [], future: []});

  const [clipboard, setClipboard] = useState<Set<string>>(new Set());

  const state = historyState.current;
  const setState = (s: SetStateAction<VisualEditorState>) => {
    setHistoryState(historyState => {
      let newState;
      if (typeof s === 'function') {
        newState = s(historyState.current);
      }
      else {
        newState = s;
      }
      return {
        ...historyState,
        current: newState,
      };
    });
  }

  function checkPoint() {
    setHistoryState(historyState => ({
      ...historyState,
      history: [...historyState.history, historyState.current],
      future: [],
    }));
  }
  function undo() {
    setHistoryState(historyState => {
      if (historyState.history.length === 0) {
        return historyState; // no change
      }
      return {
        current: historyState.history.at(-1)!,
        history: historyState.history.slice(0,-1),
        future: [...historyState.future, historyState.current],
      }
    })
  }
  function redo() {
    setHistoryState(historyState => {
      if (historyState.future.length === 0) {
        return historyState; // no change
      }
      return {
        current: historyState.future.at(-1)!,
        history: [...historyState.history, historyState.current],
        future: historyState.future.slice(0,-1),
      }
    });
  }

  const [dragging, setDragging] = useState<DraggingState>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // uid's of selected rountangles
  const [selection, setSelection] = useState<Selection>([]);

  // not null while the user is making a selection
  const [selectingState, setSelectingState] = useState<SelectingState>(null);

  const refSVG = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const compressedState = window.location.hash.slice(1);
    try {
      const compressedBuffer = Uint8Array.fromBase64(compressedState);
      const recoveredState = JSON.parse(new TextDecoder().decode(lz4.decompress(compressedBuffer)));
      setState(recoveredState);
    }
    catch (e) {
      console.error("could not recover state:", e);
    }
  }, []);

  useEffect(() => {
    // delay is necessary for 2 reasons:
    //   1) it's a hack - prevents us from writing the initial state to localstorage (before having recovered the state that was in localstorage)
    //   2) performance: only save when the user does nothing
    const timeout = setTimeout(() => {
      const stateBuffer = new TextEncoder().encode(JSON.stringify(state));
      const compressedStateBuffer = lz4.compress(stateBuffer);
      const compressedStateString = compressedStateBuffer.toBase64();
      window.location.hash = "#"+compressedStateString;

      // const [statechart, errors] = parseStatechart(state);
      // setErrors(errors);
      // setAST(statechart);
    }, 200);
    return () => clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    const [statechart, errors] = parseStatechart(state);
    setErrors(errors);
    setAST(statechart);
  }, [state])
  

  function getCurrentPointer(e: {pageX: number, pageY: number}) {
    const bbox = refSVG.current!.getBoundingClientRect();
    return {
      x: e.pageX - bbox.left,
      y: e.pageY - bbox.top,
    }
  }

  const onMouseDown = (e: MouseEvent) => {
    const currentPointer = getCurrentPointer(e);

    if (e.button === 2) {
      checkPoint();
      // ignore selection, middle mouse button always inserts
      setState(state => {
        const newID = state.nextID.toString();
        if (mode === "and" || mode === "or" || mode === "pseudo") {
          // insert rountangle
          setSelection([{uid: newID, parts: ["bottom", "right"]}]);
          return {
            ...state,
            rountangles: [...state.rountangles, {
              uid: newID,
              topLeft: currentPointer,
              size: MIN_ROUNTANGLE_SIZE,
              kind: mode,
            }],
            nextID: state.nextID+1,
          };
        }
        else if (mode === "transition") {
          setSelection([{uid: newID, parts: ["end"]}]);
          return {
            ...state,
            arrows: [...state.arrows, {
              uid: newID,
              start: currentPointer,
              end: currentPointer,
            }],
            nextID: state.nextID+1,
          }
        }
        else if (mode === "text") {
          setSelection([{uid: newID, parts: ["text"]}]);
          return {
            ...state,
            texts: [...state.texts, {
              uid: newID,
              text: "// Double-click to edit",
              topLeft: currentPointer,
            }],
            nextID: state.nextID+1,
          }
        }
        throw new Error("unreachable, mode=" + mode); // shut up typescript
      });
      setDragging({
        lastMousePos: currentPointer,
      });
      return;
    }

    if (e.button === 0) {
      // left mouse button on a shape will drag that shape (and everything else that's selected). if the shape under the pointer was not in the selection then the selection is reset to contain only that shape.
      const uid = e.target?.dataset.uid;
      const parts: string[] = e.target?.dataset.parts?.split(' ') || [];
      if (uid) {
        checkPoint();

        // if the mouse button is pressed outside of the current selection, we reset the selection to whatever shape the mouse is on
        let allPartsInSelection = true;
        for (const part of parts) {
          if (!(selection.find(s => s.uid === uid)?.parts || [] as string[]).includes(part)) {
            allPartsInSelection = false;
            break;
          }
        }
        if (!allPartsInSelection) {
          setSelection([{uid, parts}] as Selection);
        }

        // start dragging
        setDragging({
          lastMousePos: currentPointer,
        });
        return;
      }
    }

    // otherwise, just start making a selection
    setDragging(null);
    setSelectingState({
      topLeft: currentPointer,
      size: {x: 0, y: 0},
    });
    setSelection([]);
  };

  const onMouseMove = (e: {pageX: number, pageY: number}) => {
    const currentPointer = getCurrentPointer(e);
    if (dragging) {
      const pointerDelta = subtractV2D(currentPointer, dragging.lastMousePos);
      setState(state => ({
        ...state,
        rountangles: state.rountangles.map(r => {
          const parts = selection.find(selected => selected.uid === r.uid)?.parts || [];
          if (parts.length === 0) {
            return r;
          }
          return {
            uid: r.uid,
            kind: r.kind,
            ...transformRect(r, parts, pointerDelta),
          };
        })
        .toSorted((a,b) => area(b) - area(a)), // sort: smaller rountangles are drawn on top
        arrows: state.arrows.map(a => {
          const parts = selection.find(selected => selected.uid === a.uid)?.parts || [];
          if (parts.length === 0) {
            return a;
          }
          return {
            uid: a.uid,
            ...transformLine(a, parts, pointerDelta),
          }
        }),
        texts: state.texts.map(t => {
          const parts = selection.find(selected => selected.uid === t.uid)?.parts || [];
          if (parts.length === 0) {
            return t;
          }
          return {
            uid: t.uid,
            text: t.text,
            topLeft: addV2D(t.topLeft, pointerDelta),
          }
        }),
      }));
      setDragging({lastMousePos: currentPointer});
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
  };

  const onMouseUp = (e) => {
    if (dragging) {
      setDragging(null);
      // do not persist sizes smaller than 40x40
      setState(state => {
        return {
          ...state,
          rountangles: state.rountangles.map(r => ({
            ...r,
            size: rountangleMinSize(r.size),
          })),
        };
      });
    }
    if (selectingState) {
      // we were making a selection
      if (selectingState.size.x === 0 && selectingState.size.y === 0) {
        const uid = e.target?.dataset.uid;
        const parts: string[] = e.target?.dataset.parts?.split(' ') || [];
        if (uid) {
          checkPoint();
          // @ts-ignore
          setSelection(() => ([{uid, parts}]));

          // if the mouse button is pressed outside of the current selection, we reset the selection to whatever shape the mouse is on
          let allPartsInSelection = true;
          for (const part of parts) {
            if (!(selection.find(s => s.uid === uid)?.parts || [] as string[]).includes(part)) {
              allPartsInSelection = false;
              break;
            }
          }
        }
      }
      else {
        const normalizedSS = normalizeRect(selectingState);
        const shapes = Array.from(refSVG.current?.querySelectorAll("rect, line, circle, text") || []) as SVGGraphicsElement[];
        const shapesInSelection = shapes.filter(el => {
          const bbox = getBBoxInSvgCoords(el, refSVG.current!);
          return isEntirelyWithin(bbox, normalizedSS);
        }).filter(el => !el.classList.contains("corner"));
        
        const uidToParts = new Map();
        for (const shape of shapesInSelection) {
          const uid = shape.dataset.uid;
          if (uid) {
            const parts: Set<string> = uidToParts.get(uid) || new Set();
            for (const part of shape.dataset.parts?.split(' ') || []) {
              parts.add(part);
            }
            uidToParts.set(uid, parts);
          }
        }
        setSelection(() => [...uidToParts.entries()].map(([uid,parts]) => ({
          uid,
          parts: [...parts],
        })));
      }
    }
    setSelectingState(null); // no longer making a selection
  };

  function deleteShapes(selection: Selection) {
    setState(state => ({
      ...state,
      rountangles: state.rountangles.filter(r => !selection.some(rs => rs.uid === r.uid)),
      arrows: state.arrows.filter(a => !selection.some(as => as.uid === a.uid)),
      texts: state.texts.filter(t => !selection.some(ts => ts.uid === t.uid)),
    }));
    setSelection([]);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Delete") {
      // delete selection
      if (selection.length > 0) {
        checkPoint();
        deleteShapes(selection);
      }
    }
    if (e.key === "o") {
      // selected states become OR-states
      setSelection(selection => {
        setState(state => ({
          ...state,
          rountangles: state.rountangles.map(r => selection.some(rs => rs.uid === r.uid) ? ({...r, kind: "or"}) : r),
        }));
        return selection;
      })
    }
    if (e.key === "a") {
      // selected states become AND-states
      setSelection(selection => {
        setState(state => ({
          ...state,
          rountangles: state.rountangles.map(r => selection.some(rs => rs.uid === r.uid) ? ({...r, kind: "and"}) : r),
        }));
        return selection;
      });
    }
    if (e.key === "p") {
      // selected states become pseudo-states
      setSelection(selection => {
        setState(state => ({
          ...state,
          rountangles: state.rountangles.map(r => selection.some(rs => rs.uid === r.uid) ? ({...r, kind: "pseudo"}) : r),
        }));
        return selection;
      });
    }
    if (e.key === "h") {
      setShowHelp(showHelp => !showHelp);
    }
    if (e.ctrlKey) {
      // if (e.key === "c") {
      //   if (selection.length > 0) {
      //     e.preventDefault();
      //     setClipboard(new Set(selection.map(shape => shape.uid)));
      //     console.log('set clipboard', new Set(selection.map(shape => shape.uid)));
      //   }
      // }
      // if (e.key === "v") {
      //   console.log('paste shortcut..', clipboard);
      //   if (clipboard.size > 0) {
      //     console.log('pasting...a');
      //     e.preventDefault();
      //     checkPoint();
      //     const offset = {x: 40, y: 40};
      //     const rountanglesToCopy = state.rountangles.filter(r => clipboard.has(r.uid));
      //     const arrowsToCopy = state.arrows.filter(a => clipboard.has(a.uid));
      //     const textsToCopy = state.texts.filter(t => clipboard.has(t.uid));
      //     let nextUid = state.nextID;
      //     const rountanglesCopied: Rountangle[] = rountanglesToCopy.map(r => ({
      //       ...r,
      //       uid: (nextUid++).toString(),
      //       topLeft: addV2D(r.topLeft, offset),
      //     }));
      //     const arrowsCopied: Arrow[] = arrowsToCopy.map(a => ({
      //       ...a,
      //       uid: (nextUid++).toString(),
      //       start: addV2D(a.start, offset),
      //       end: addV2D(a.end, offset),
      //     }));
      //     const textsCopied: Text[] = textsToCopy.map(t => ({
      //       ...t,
      //       uid: (nextUid++).toString(),
      //       topLeft: addV2D(t.topLeft, offset),
      //     }));
      //     setState(state => ({
      //       ...state,
      //       rountangles: [...state.rountangles, ...rountanglesCopied],
      //       arrows: [...state.arrows, ...arrowsCopied],
      //       texts: [...state.texts, ...textsCopied],
      //       nextID: nextUid,
      //     }));
      //     setClipboard(new Set([
      //       ...rountanglesCopied.map(r => r.uid),
      //       ...arrowsCopied.map(a => a.uid),
      //       ...textsCopied.map(t => t.uid),
      //     ]));
      //     // @ts-ignore
      //     setSelection([
      //       ...rountanglesCopied.map(r => ({uid: r.uid, parts: ["left", "top", "right", "bottom"]})),
      //       ...arrowsCopied.map(a => ({uid: a.uid, parts: ["start", "end"]})),
      //       ...textsCopied.map(t => ({uid: t.uid, parts: ["text"]})),
      //     ]);
      //   }
      // }
      if (e.key === "z") {
        e.preventDefault();
        undo();
      }
      if (e.key === "Z") {
        e.preventDefault();
        redo();
      }
      if (e.key === "a") {
        e.preventDefault();
        setDragging(null);
        // @ts-ignore
        setSelection([
          ...state.rountangles.map(r => ({uid: r.uid, parts: ["left", "top", "right", "bottom"]})),
          ...state.arrows.map(a => ({uid: a.uid, parts: ["start", "end"]})),
          ...state.texts.map(t => ({uid: t.uid, parts: ["text"]})),
        ]);
      }

      if (e.key === "c") {
        // e.preventDefault();
        // setClipboard()
      }
    }
  };

  useEffect(() => {
    // mousemove and mouseup are global event handlers so they keep working when pointer is outside of browser window
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [selectingState, dragging, clipboard]);

  // detect what is 'connected'
  const arrow2SideMap = new Map<string,[{ uid: string; part: RountanglePart; } | undefined, { uid: string; part: RountanglePart; } | undefined]>();
  const side2ArrowMap = new Map<string, Set<["start"|"end", string]>>();
  const text2ArrowMap = new Map<string,string>();
  const arrow2TextMap = new Map<string,string[]>();
  const text2RountangleMap = new Map<string, string>();
  const rountangle2TextMap = new Map<string, string[]>();
  for (const arrow of state.arrows) {
    const startSide = findNearestRountangleSide(arrow, "start", state.rountangles);
    const endSide = findNearestRountangleSide(arrow, "end", state.rountangles);
    if (startSide || endSide) {
      arrow2SideMap.set(arrow.uid, [startSide, endSide]);
    }
    if (startSide) {
      const arrowConns = side2ArrowMap.get(startSide.uid + '/' + startSide.part) || new Set();
      arrowConns.add(["start", arrow.uid]);
      side2ArrowMap.set(startSide.uid + '/' + startSide.part, arrowConns);
    }
    if (endSide) {
      const arrowConns = side2ArrowMap.get(endSide.uid + '/' + endSide.part) || new Set();
      arrowConns.add(["end", arrow.uid]);
      side2ArrowMap.set(endSide.uid + '/' + endSide.part, arrowConns);
    }
  }
  for (const text of state.texts) {
    const nearestArrow = findNearestArrow(text.topLeft, state.arrows);
    if (nearestArrow) {
      // prioritize text belonging to arrows:
      text2ArrowMap.set(text.uid, nearestArrow.uid);
      const textsOfArrow = arrow2TextMap.get(nearestArrow.uid) || [];
      textsOfArrow.push(text.uid);
      arrow2TextMap.set(nearestArrow.uid, textsOfArrow);
    }
    else {
      // no arrow, then the text belongs to the rountangle it is in
      const rountangle = findRountangle(text.topLeft, state.rountangles);
      if (rountangle) {
        text2RountangleMap.set(text.uid, rountangle.uid);
        const texts = rountangle2TextMap.get(rountangle.uid) || [];
        texts.push(text.uid);
        rountangle2TextMap.set(rountangle.uid, texts);
      }
    }
  }

  // for visual feedback, when selecting/moving one thing, we also highlight (in green) all the things that belong to the thing we selected.
  const sidesToHighlight: {[key: string]: RountanglePart[]} = {};
  const arrowsToHighlight: {[key: string]: boolean} = {};
  const textsToHighlight: {[key: string]: boolean} = {};
  const rountanglesToHighlight: {[key: string]: boolean} = {};
  for (const selected of selection) {
    const sides = arrow2SideMap.get(selected.uid);
    if (sides) {
      const [startSide, endSide] = sides;
      if (startSide) sidesToHighlight[startSide.uid] = [...sidesToHighlight[startSide.uid]||[], startSide.part];
      if (endSide) sidesToHighlight[endSide.uid] = [...sidesToHighlight[endSide.uid]||[], endSide.part];
    }
    const texts = [
      ...(arrow2TextMap.get(selected.uid) || []),
      ...(rountangle2TextMap.get(selected.uid) || []),
    ];
    for (const textUid of texts) {
      textsToHighlight[textUid] = true;
    }
    for (const part of selected.parts) {
      const arrows = side2ArrowMap.get(selected.uid + '/' + part) || [];
      if (arrows) {
        for (const [arrowPart, arrowUid] of arrows) {
          arrowsToHighlight[arrowUid] = true;
        }
      }
    }
    const arrow2 = text2ArrowMap.get(selected.uid);
    if (arrow2) {
      arrowsToHighlight[arrow2] = true;
    }
    const rountangleUid = text2RountangleMap.get(selected.uid)
    if (rountangleUid) {
      rountanglesToHighlight[rountangleUid] = true;
    }
  }

  function onPaste(e: ClipboardEvent) {
    const data = e.clipboardData?.getData("text/plain");
    if (data) {
      let parsed;
      try {
        parsed = JSON.parse(data);
      }
      catch (e) {
        return;
      }
      // const offset = {x: 40, y: 40};
      const offset = {x: 0, y: 0};
      let nextID = state.nextID;
      try {
        const copiedRountangles: Rountangle[] = parsed.rountangles.map((r: Rountangle) => ({
          ...r,
          uid: (nextID++).toString(),
          topLeft: addV2D(r.topLeft, offset),
        } as Rountangle));
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
        setState(state => ({
          ...state,
          rountangles: [...state.rountangles, ...copiedRountangles],
          arrows: [...state.arrows, ...copiedArrows],
          texts: [...state.texts, ...copiedTexts],
          nextID: nextID,
        }));
        // @ts-ignore
        const newSelection: Selection = [
          ...copiedRountangles.map(r => ({uid: r.uid, parts: ["left", "top", "right", "bottom"]})),
          ...copiedArrows.map(a => ({uid: a.uid, parts: ["start", "end"]})),
          ...copiedTexts.map(t => ({uid: t.uid, parts: ["text"]})),
        ];
        setSelection(newSelection);
        // copyInternal(newSelection, e); // doesn't work
        e.preventDefault();
      }
      catch (e) {
      }
    }
  }

  function copyInternal(selection: Selection, e: ClipboardEvent) {
    const uidsToCopy = new Set(selection.map(shape => shape.uid));
    const rountanglesToCopy = state.rountangles.filter(r => uidsToCopy.has(r.uid));
    const arrowsToCopy = state.arrows.filter(a => uidsToCopy.has(a.uid));
    const textsToCopy = state.texts.filter(t => uidsToCopy.has(t.uid));
    e.clipboardData?.setData("text/plain", JSON.stringify({
      rountangles: rountanglesToCopy,
      arrows: arrowsToCopy,
      texts: textsToCopy,
    }));
  }

  function onCopy(e: ClipboardEvent) {
    if (selection.length > 0) {
      e.preventDefault();
      copyInternal(selection, e);
    }
  }

  function onCut(e: ClipboardEvent) {
    if (selection.length > 0) {
      copyInternal(selection, e);
      deleteShapes(selection);
      e.preventDefault();
    }
    
  }

  const active = rt?.mode || new Set();

  const rootErrors = errors.filter(({shapeUid}) => shapeUid === "root").map(({message}) => message);

  return <svg width="4000px" height="4000px"
      className={"svgCanvas"+(active.has("root")?" active":"")+(dragging!==null?" dragging":"")}
      onMouseDown={onMouseDown}
      onContextMenu={e => e.preventDefault()}
      ref={refSVG}
      onCopy={onCopy}
      onPaste={onPaste}
      onCut={onCut}
    >
      <defs>
        <marker
          id="arrowEnd"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>

    {(rootErrors.length>0) && <text className="error" x={5} y={20}>{rootErrors.join(' ')}</text>}

    {state.rountangles.map(rountangle => <RountangleSVG
      key={rountangle.uid}
      rountangle={rountangle}
      selected={selection.find(r => r.uid === rountangle.uid)?.parts || []}
      highlight={[...(sidesToHighlight[rountangle.uid] || []), ...(rountanglesToHighlight[rountangle.uid]?["left","right","top","bottom"]:[]) as RountanglePart[]]}
      errors={errors
        .filter(({shapeUid}) => shapeUid === rountangle.uid)
        .map(({message}) => message)}
      active={active.has(rountangle.uid)}
      />)}

    {state.arrows.map(arrow => {
      const sides = arrow2SideMap.get(arrow.uid);
      let arc = "no" as ArcDirection;
      if (sides && sides[0]?.uid === sides[1]?.uid && sides[0]!.uid !== undefined) {
        arc = arcDirection(sides[0]!.part, sides[1]!.part);
      }
      return <ArrowSVG
        key={arrow.uid}
        arrow={arrow}
        selected={selection.find(a => a.uid === arrow.uid)?.parts || []}
        errors={errors
          .filter(({shapeUid}) => shapeUid === arrow.uid)
          .map(({message}) => message)}
        highlight={arrowsToHighlight.hasOwnProperty(arrow.uid)}
        arc={arc}
        />;
      }
    )}

    {state.texts.map(txt => {
      const err = errors.find(({shapeUid}) => txt.uid === shapeUid);
      const commonProps = {
        "data-uid": txt.uid,
        "data-parts": "text",
        textAnchor: "middle" as "middle",
        className: 
          (selection.find(s => s.uid === txt.uid)?.parts?.length ? "selected":"")
          +(textsToHighlight.hasOwnProperty(txt.uid)?" highlight":""),
      }
      let textNode;
      if (err?.data?.location) {
        const {start,end} = err.data.location;
        textNode = <><text {...commonProps}>
          {txt.text.slice(0, start.offset)}
          <tspan className="error" data-uid={txt.uid} data-parts="text">
            {txt.text.slice(start.offset, end.offset)}
            {start.offset === end.offset && <>_</>}
          </tspan>
          {txt.text.slice(end.offset)}
        </text>
        <text className="error errorHover" y={20} textAnchor="middle">{err.message}</text></>;
      }
      else {
        textNode = <text {...commonProps}>{txt.text}</text>;
      }
      return <g
        key={txt.uid}
        transform={`translate(${txt.topLeft.x} ${txt.topLeft.y})`}
        onDoubleClick={() => {
          const newText = prompt("", txt.text);
          if (newText) {
            setState(state => ({
              ...state,
              texts: state.texts.map(t => {
                if (t.uid === txt.uid) {
                  return {
                    ...txt,
                    text: newText,
                  }
                }
                else {
                  return t;
                }
              }),
            }));
          }
          else if (newText === "") {
            setState(state => ({
              ...state,
              texts: state.texts.filter(t => t.uid !== txt.uid),
            }));
          }
        }}
      >{textNode}</g>;})}

    {selectingState && <Selecting {...selectingState} />}
  </svg>;
}

export function rountangleMinSize(size: Vec2D): Vec2D {
  if (size.x >= 40 && size.y >= 40) {
    return size;
  }
  return {
    x: Math.max(40, size.x),
    y: Math.max(40, size.y),
  };
}

export function Selecting(props: SelectingState) {
  const normalizedRect = normalizeRect(props!);
  return <rect
    className="selecting"
    x={normalizedRect.topLeft.x}
    y={normalizedRect.topLeft.y}
    width={normalizedRect.size.x}
    height={normalizedRect.size.y}
  />;
}