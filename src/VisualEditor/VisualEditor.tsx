import * as lz4 from "@nick/lz4";
import { Dispatch, MouseEventHandler, SetStateAction, useEffect, useRef, useState, MouseEvent } from "react";

import { Statechart } from "../statecharts/abstract_syntax";
import { Arrow, ArrowPart, Rountangle, RountanglePart, VisualEditorState, emptyState, findNearestArrow, findNearestRountangleSide, findRountangle } from "../statecharts/concrete_syntax";
import { parseStatechart, TraceableError } from "../statecharts/parser";
import { BigStep } from "../statecharts/runtime_types";
import { ArcDirection, Line2D, Rect2D, Vec2D, addV2D, arcDirection, area, euclideanDistance, getBottomSide, getLeftSide, getRightSide, getTopSide, isEntirelyWithin, normalizeRect, subtractV2D, transformLine, transformRect } from "./geometry";
import { CORNER_HELPER_OFFSET, CORNER_HELPER_RADIUS, MIN_ROUNTANGLE_SIZE, ROUNTANGLE_RADIUS } from "./parameters";
import { getBBoxInSvgCoords } from "./svg_helper";

import "./VisualEditor.css";


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

type VisualEditorProps = {
  setAST: Dispatch<SetStateAction<Statechart>>,
  rt: BigStep|undefined,
  errors: TraceableError[],
  setErrors: Dispatch<SetStateAction<TraceableError[]>>,
};

export function VisualEditor({setAST, rt, errors, setErrors}: VisualEditorProps) {
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
  const [mode, setMode] = useState<"state"|"transition"|"text">("state");
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

      const [statechart, errors] = parseStatechart(state);
      // console.log('statechart: ', statechart, 'errors:', errors);
      setErrors(errors);
      setAST(statechart);
    }, 100);
    return () => clearTimeout(timeout);
  }, [state]);

  function getCurrentPointer(e: {pageX: number, pageY: number}) {
    const bbox = refSVG.current!.getBoundingClientRect();
    return {
      x: e.pageX - bbox.left,
      y: e.pageY - bbox.top,
    }
  }

  const onMouseDown = (e: MouseEvent) => {
    const currentPointer = getCurrentPointer(e);

    if (e.button === 1) {
      checkPoint();
      // ignore selection, middle mouse button always inserts
      setState(state => {
        const newID = state.nextID.toString();
        if (mode === "state") {
          // insert rountangle
          setSelection([{uid: newID, parts: ["bottom", "right"]}]);
          return {
            ...state,
            rountangles: [...state.rountangles, {
              uid: newID,
              topLeft: currentPointer,
              size: MIN_ROUNTANGLE_SIZE,
              kind: "and",
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
        throw new Error("unreachable"); // shut up typescript
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

  const onMouseUp = () => {
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
        kind: "rountangle",
        uid,
        parts: [...parts],
      })));
      setSelectingState(null); // no longer making a selection
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Delete") {
      // delete selection
      if (selection.length > 0) {
        checkPoint();
        setState(state => ({
          ...state,
          rountangles: state.rountangles.filter(r => !selection.some(rs => rs.uid === r.uid)),
          arrows: state.arrows.filter(a => !selection.some(as => as.uid === a.uid)),
          texts: state.texts.filter(t => !selection.some(ts => ts.uid === t.uid)),
        }));
        setSelection([]);
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
    if (e.key === "h") {
      setShowHelp(showHelp => !showHelp);
    }
    if (e.key === "s") {
      setMode("state");
    }
    if (e.key === "t") {
      setMode("transition");
    }
    if (e.key === "x") {
      setMode("text");
    }

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
  }, [selectingState, dragging]);

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

  const active = rt?.mode || new Set();

  const rootErrors = errors.filter(({shapeUid}) => shapeUid === "root").map(({message}) => message);

  return <svg width="4000px" height="4000px"
      className={"svgCanvas"+(active.has("root")?" active":"")}
      onMouseDown={onMouseDown}
      onContextMenu={e => e.preventDefault()}
      ref={refSVG}
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

    {(rootErrors.length>0) && <text className="error" x={5} y={50}>{rootErrors.join(' ')}</text>}

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
      if (err) {
        const {start,end} = err.data;
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

    {/* {showHelp ? <>
      <text x={5} y={20}>
        Left mouse button: Select/Drag.
      </text>
      <text x={5} y={40}>
        Right mouse button: Select only.
      </text>
      <text x={5} y={60}>
        Middle mouse button: Insert [S]tates / [T]ransitions / Te[X]t (current mode: {mode})</text>
      <text x={5} y={80}>
        [Del] Delete selection.
      </text>
      <text x={5} y={100}>
        [O] Turn selected states into OR-states.
      </text>
      <text x={5} y={120}>
        [A] Turn selected states into AND-states.
      </text>
      <text x={5} y={140}>
        [H] Show/hide this help.
      </text>
    </> : <text x={5} y={20}>[H] To show help.</text>} */}

  </svg>;
}

function rountangleMinSize(size: Vec2D): Vec2D {
  if (size.x >= 40 && size.y >= 40) {
    return size;
  }
  return {
    x: Math.max(40, size.x),
    y: Math.max(40, size.y),
  };
}

export function RountangleSVG(props: {rountangle: Rountangle, selected: string[], highlight: RountanglePart[], errors: string[], active: boolean}) {
  const {topLeft, size, uid} = props.rountangle;
  // always draw a rountangle with a minimum size
  // during resizing, rountangle can be smaller than this size and even have a negative size, but we don't show it
  const minSize = rountangleMinSize(size);
  return <g transform={`translate(${topLeft.x} ${topLeft.y})`}>
    <rect
      className={"rountangle"
        +(props.selected.length===4?" selected":"")
        +((props.rountangle.kind==="or")?" or":"")
        +(props.errors.length>0?" error":"")
        +(props.active?" active":"")
      }
      rx={ROUNTANGLE_RADIUS} ry={ROUNTANGLE_RADIUS}
      x={0}
      y={0}
      width={minSize.x}
      height={minSize.y}
      data-uid={uid}
      data-parts="left top right bottom"
    />

    {(props.errors.length>0) &&
      <text className="error" x={10} y={40} data-uid={uid} data-parts="left top right bottom">{props.errors.join(' ')}</text>}


    <line
      className={"lineHelper"
        +(props.selected.includes("top")?" selected":"")
        +(props.highlight.includes("top")?" highlight":"")
      }
      x1={0}
      y1={0}
      x2={minSize.x}
      y2={0}
      data-uid={uid}
      data-parts="top"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("right")?" selected":"")
        +(props.highlight.includes("right")?" highlight":"")
      }
      x1={minSize.x}
      y1={0}
      x2={minSize.x}
      y2={minSize.y}
      data-uid={uid}
      data-parts="right"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("bottom")?" selected":"")
        +(props.highlight.includes("bottom")?" highlight":"")
      }
      x1={0}
      y1={minSize.y}
      x2={minSize.x}
      y2={minSize.y}
      data-uid={uid}
      data-parts="bottom"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("left")?" selected":"")
        +(props.highlight.includes("left")?" highlight":"")
      }
      x1={0}
      y1={0}
      x2={0}
      y2={minSize.y}
      data-uid={uid}
      data-parts="left"
    />

    <circle
      className="circleHelper corner"
      cx={CORNER_HELPER_OFFSET}
      cy={CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="top left"
      />
    <circle
      className="circleHelper corner"
      cx={minSize.x-CORNER_HELPER_OFFSET}
      cy={CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="top right"
      />
    <circle
      className="circleHelper corner"
      cx={minSize.x-CORNER_HELPER_OFFSET}
      cy={minSize.y-CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="bottom right"
      />
    <circle
      className="circleHelper corner"
      cx={CORNER_HELPER_OFFSET}
      cy={minSize.y-CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="bottom left"
      />
    <text x={10} y={20}
      className="uid"
      data-uid={uid}>{uid}</text>
  </g>;
}

export function ArrowSVG(props: {arrow: Arrow, selected: string[], errors: string[], highlight: boolean, arc: ArcDirection}) {
  const {start, end, uid} = props.arrow;
  const radius = euclideanDistance(start, end)/1.6;
  const largeArc = "1";
  const arcOrLine = props.arc === "no" ? "L" :
    `A ${radius} ${radius} 0 ${largeArc} ${props.arc === "ccw" ? "0" : "1"}`;
  return <g>
    <path
      className={"arrow"
        +(props.selected.length===2?" selected":"")
        +(props.errors.length>0?" error":"")
        +(props.highlight?" highlight":"")
      }
      markerEnd='url(#arrowEnd)'
      d={`M ${start.x} ${start.y}
            ${arcOrLine}
            ${end.x} ${end.y}`}
      data-uid={uid}
      data-parts="start end"
    />

    {props.errors.length>0 && <text className="error" x={(start.x+end.x)/2+5} y={(start.y+end.y)/2} data-uid={uid} data-parts="start end">{props.errors.join(' ')}</text>}

    <path
      className="pathHelper"
      // markerEnd='url(#arrowEnd)'
      d={`M ${start.x} ${start.y}
            ${arcOrLine}
            ${end.x} ${end.y}`}
      data-uid={uid}
      data-parts="start end"
    />

    <circle
      className={"circleHelper"
        +(props.selected.includes("start")?" selected":"")}
      cx={start.x}
      cy={start.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="start"
    />
    <circle
      className={"circleHelper"
        +(props.selected.includes("end")?" selected":"")}
      cx={end.x}
      cy={end.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="end"
    />
  </g>;
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