import * as lz4 from "@nick/lz4";
import { Dispatch, SetStateAction, useEffect, useRef, useState, MouseEvent } from "react";

import { Statechart } from "../statecharts/abstract_syntax";
import { Arrow, ArrowPart, Diamond, Rountangle, RountanglePart, Text, VisualEditorState, emptyState, findNearestArrow, findNearestSide, findRountangle } from "../statecharts/concrete_syntax";
import { parseStatechart, TraceableError } from "../statecharts/parser";
import { BigStep } from "../statecharts/runtime_types";
import { ArcDirection, Line2D, Rect2D, Vec2D, addV2D, arcDirection, area, getBottomSide, getLeftSide, getRightSide, getTopSide, isEntirelyWithin, normalizeRect, subtractV2D, transformLine, transformRect } from "./geometry";
import { MIN_ROUNTANGLE_SIZE } from "./parameters";
import { getBBoxInSvgCoords } from "./svg_helper";

import "./VisualEditor.css";
import { ArrowSVG } from "./ArrowSVG";
import { RountangleSVG } from "./RountangleSVG";
import { TextSVG } from "./TextSVG";
import { DiamondSVG } from "./DiamondSVG";
import { HistorySVG } from "./HistorySVG";


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
type HistorySelectable = {
  parts: ["history"];
  uid: string;
}
type Selectable = RountangleSelectable | ArrowSelectable | TextSelectable | HistorySelectable;
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

export type InsertMode = "and"|"or"|"pseudo"|"shallow"|"deep"|"transition"|"text";

type VisualEditorProps = {
  setAST: Dispatch<SetStateAction<Statechart>>,
  rt: BigStep|undefined,
  errors: TraceableError[],
  setErrors: Dispatch<SetStateAction<TraceableError[]>>,
  mode: InsertMode,
};

export function VisualEditor({setAST, rt, errors, setErrors, mode}: VisualEditorProps) {
  const [historyState, setHistoryState] = useState<HistoryState>({current: emptyState, history: [], future: []});

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

  const onMouseDown = (e: {button: number, target: any, pageX: number, pageY: number}) => {
    const currentPointer = getCurrentPointer(e);

    if (e.button === 2) {
      checkPoint();
      // ignore selection, middle mouse button always inserts
      setState(state => {
        const newID = state.nextID.toString();
        if (mode === "and" || mode === "or") {
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
        else if (mode === "pseudo") {
          setSelection([{uid: newID, parts: ["bottom", "right"]}]);
          return {
            ...state,
            diamonds: [...state.diamonds, {
              uid: newID,
              topLeft: currentPointer,
              size: MIN_ROUNTANGLE_SIZE,
            }],
            nextID: state.nextID+1,
          };
        }
        else if (mode === "shallow" || mode === "deep") {
          setSelection([{uid: newID, parts: ["history"]}]);
          return {
            ...state,
            history: [...state.history, {
              uid: newID,
              kind: mode,
              topLeft: currentPointer,
            }],
            nextID: state.nextID+1,
          }
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
      const parts: string[] = e.target?.dataset.parts?.split(' ').filter((p:string) => p!=="") || [];
      if (uid && parts.length > 0) {
        console.log('start drag');
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
          if (e.target.classList.contains("helper")) {
            setSelection([{uid, parts}] as Selection);
          }
          else {
            setDragging(null);
            setSelectingState({
              topLeft: currentPointer,
              size: {x: 0, y: 0},
            });
            setSelection([]);
            return;
          }
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
            ...r,
            ...transformRect(r, parts, pointerDelta),
          };
        })
        .toSorted((a,b) => area(b) - area(a)), // sort: smaller rountangles are drawn on top
        diamonds: state.diamonds.map(d => {
          const parts = selection.find(selected => selected.uid === d.uid)?.parts || [];
          if (parts.length === 0) {
            return d;
          }
          return {
            ...d,
            ...transformRect(d, parts, pointerDelta),
          }
        }),
        history: state.history.map(h => {
          const parts = selection.find(selected => selected.uid === h.uid)?.parts || [];
          if (parts.length === 0) {
            return h;
          }
          return {
            ...h,
            topLeft: addV2D(h.topLeft, pointerDelta),
          }
        }),
        arrows: state.arrows.map(a => {
          const parts = selection.find(selected => selected.uid === a.uid)?.parts || [];
          if (parts.length === 0) {
            return a;
          }
          return {
            ...a,
            ...transformLine(a, parts, pointerDelta),
          }
        }),
        texts: state.texts.map(t => {
          const parts = selection.find(selected => selected.uid === t.uid)?.parts || [];
          if (parts.length === 0) {
            return t;
          }
          return {
            ...t,
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

  const onMouseUp = (e: {target: any, pageX: number, pageY: number}) => {
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
          const parts = e.target?.dataset.parts.split(' ').filter((p: string) => p!=="");
          if (uid) {
            setSelection(() => [{
              uid,
              parts,
            }]);
          }
        }
      }
      else {
        // we were making a selection
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
      diamonds: state.diamonds.filter(d => !selection.some(ds => ds.uid === d.uid)),
      history: state.history.filter(h => !selection.some(hs => hs.uid === h.uid)),
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
  }, [selectingState, dragging]);

  // detect what is 'connected'
  const arrow2SideMap = new Map<string,[{ uid: string; part: RountanglePart; } | undefined, { uid: string; part: RountanglePart; } | undefined]>();
  const side2ArrowMap = new Map<string, Set<["start"|"end", string]>>();
  const text2ArrowMap = new Map<string,string>();
  const arrow2TextMap = new Map<string,string[]>();
  const text2RountangleMap = new Map<string, string>();
  const rountangle2TextMap = new Map<string, string[]>();

  // arrow <-> (rountangle | diamond)
  for (const arrow of state.arrows) {
    const sides = [...state.rountangles, ...state.diamonds];
    const startSide = findNearestSide(arrow, "start", sides);
    const endSide = findNearestSide(arrow, "end", sides);
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
  // text <-> arrow
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
      // text <-> rountangle
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

  function onEditText(text: Text, newText: string) {
    if (newText === "") {
      // delete text node
      setState(state => ({
        ...state,
        texts: state.texts.filter(t => t.uid !== text.uid),
      }));
    }
    else {
      setState(state => ({
        ...state,
        texts: state.texts.map(t => {
          if (t.uid === text.uid) {
            return {
              ...text,
              text: newText,
            }
          }
          else {
            return t;
          }
        }),
      }));
    }
  }


  const active = rt?.mode || new Set();

  const rootErrors = errors.filter(({shapeUid}) => shapeUid === "root").map(({message}) => message);

  return <svg width="4000px" height="4000px"
      className={"svgCanvas"+(active.has("root")?" active":"")+(dragging!==null?" dragging":"")}
      onMouseDown={onMouseDown}
      onContextMenu={e => e.preventDefault()}
      ref={refSVG}

      // @ts-ignore
      onCopy={onCopy}
      // @ts-ignore
      onPaste={onPaste}
      // @ts-ignore
      onCut={onCut}
    >
      <defs>
        <marker
          id="arrowEnd"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse">
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

    {state.diamonds.map(diamond => <>
      <DiamondSVG
        key={diamond.uid}
        diamond={diamond}
        selected={selection.find(r => r.uid === diamond.uid)?.parts || []}
        highlight={[...(sidesToHighlight[diamond.uid] || []), ...(rountanglesToHighlight[diamond.uid]?["left","right","top","bottom"]:[]) as RountanglePart[]]}
        errors={errors
          .filter(({shapeUid}) => shapeUid === diamond.uid)
          .map(({message}) => message)}
        active={active.has(diamond.uid)}/>
    </>)}

    {state.history.map(history => <>
      <HistorySVG {...history} selected={selection.find(h => h.uid === history.uid)} />
    </>)}

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
      return <TextSVG
        error={errors.find(({shapeUid}) => txt.uid === shapeUid)}
        text={txt}
        selected={Boolean(selection.find(s => s.uid === txt.uid)?.parts?.length)}
        highlight={textsToHighlight.hasOwnProperty(txt.uid)}
        onEdit={newText => onEditText(txt, newText)}
      />
    })}

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