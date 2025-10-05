import { Dispatch, MouseEventHandler, SetStateAction, useEffect, useRef, useState } from "react";
import { Line2D, Rect2D, Vec2D, addV2D, area, isEntirelyWithin, normalizeRect, subtractV2D, transformLine, transformRect } from "./geometry";

import "./VisualEditor.css";
import { getBBoxInSvgCoords } from "./svg_helper";


type Rountangle = {
  uid: string;
  kind: "and" | "or";
} & Rect2D;

type Text = {
  uid: string;
  topLeft: Vec2D;
  text: string;
};

type Arrow = {
  uid: string;
} & Line2D;

type VisualEditorState = {
  rountangles: Rountangle[];
  texts: Text[];
  arrows: Arrow[];
  nextID: number;
};

const emptyState = {
  rountangles: [], texts: [], arrows: [], nextID: 0,
};

const onOffStateMachine = {
  rountangles: [
    { uid: "0", topLeft: {x: 100, y: 100}, size: {x: 100, y: 100}, kind: "and" },
    { uid: "1", topLeft: {x: 100, y: 300}, size: {x: 100, y: 100}, kind: "and" },
  ],
  texts: [],
  arrows: [
    { uid: "2", start: {x: 150, y: 200}, end: {x: 160, y: 300} },
  ],
  nextID: 3,
};

type DraggingState = {
  lastMousePos: Vec2D;
} | null; // null means: not dragging

type SelectingState = Rect2D | null;


// independently moveable parts of our shapes:
type RountanglePart = "left" | "top" | "right" | "bottom";
type ArrowPart = "start" | "end";

type RountangleSelectable = {
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

const minStateSize = {x: 40, y: 40};

type HistoryState = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}



export function VisualEditor() {
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

  const [showHelp, setShowHelp] = useState<boolean>(true);

  // uid's of selected rountangles
  const [selection, setSelection] = useState<Selection>([]);

  // not null while the user is making a selection
  const [selectingState, setSelectingState] = useState<SelectingState>(null);

  const refSVG = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const recoveredState = JSON.parse(window.localStorage.getItem("state") || "null") || emptyState;
    setState(recoveredState);
  }, []);

  // useEffect(() => {
  //   console.log(`history: ${history.length}, future: ${future.length}`);
  // }, [editorState]);

  useEffect(() => {
    // delay is necessary for 2 reasons:
    //   1) it's a hack - prevents us from writing the initial state to localstorage (before having recovered the state that was in localstorage)
    //   2) performance: only save when the user does nothing
    const timeout = setTimeout(() => {
      window.localStorage.setItem("state", JSON.stringify(state));
      console.log('saved to localStorage');
    }, 100);
    return () => clearTimeout(timeout);
  }, [state]);


  const onMouseDown: MouseEventHandler<SVGSVGElement> = (e) => {
    const currentPointer = {x: e.pageX, y: e.pageY};

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
              size: minStateSize,
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
              text: "Double-click to edit text",
              topLeft: currentPointer,
            }],
            nextID: state.nextID+1,
          }
        }
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

        let allPartsInSelection = true;
        for (const part of parts) {
          if (!(selection.find(s => s.uid === uid)?.parts || []).includes(part)) {
            allPartsInSelection = false;
            break;
          }
        }
        if (!allPartsInSelection) {
          setSelection([{uid, parts, kind: "dontcare"}]);
        }
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

  const onMouseMove = (e: MouseEvent) => {
    const currentPointer = {x: e.pageX, y: e.pageY};
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

  const onMouseUp = (e: MouseEvent) => {
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


          if (e.key === "z") {
        e.preventDefault();
        undo();
      }
      if (e.key === "Z") {
        e.preventDefault();
        redo();
      }

    if (e.ctrlKey) {
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

  return <svg width="4000px" height="4000px"
      className="svgCanvas"
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

    {state.rountangles.map(rountangle => <RountangleSVG
      key={rountangle.uid}
      rountangle={rountangle}
      selected={selection.find(r => r.uid === rountangle.uid)?.parts || []}
      />)}

    {state.arrows.map(arrow => <ArrowSVG
      key={arrow.uid}
      arrow={arrow}
      selected={selection.find(a => a.uid === arrow.uid)?.parts || []}
      />
    )}

    {state.texts.map(txt => <text
      key={txt.uid}
      className={selection.find(s => s.uid === txt.uid)?.parts?.length ? "selected":""}
      x={txt.topLeft.x}
      width={200}
      height={40}
      y={txt.topLeft.y}
      data-uid={txt.uid}
      data-parts="text"
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
      }}
    >
      {txt.text}
    </text>)}

    {selectingState && <Selecting {...selectingState} />}

    {showHelp && <>
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
    </>}

  </svg>;
}

const cornerOffset = 4;
const cornerRadius = 16;

function rountangleMinSize(size: Vec2D): Vec2D {
  if (size.x >= 40 && size.y >= 40) {
    return size;
  }
  return {
    x: Math.max(40, size.x),
    y: Math.max(40, size.y),
  };
}

export function RountangleSVG(props: {rountangle: Rountangle, selected: string[]}) {
  const {topLeft, size, uid} = props.rountangle;
  // always draw a rountangle with a minimum size
  // during resizing, rountangle can be smaller than this size and even have a negative size, but we don't show it
  const minSize = rountangleMinSize(size);
  return <g transform={`translate(${topLeft.x} ${topLeft.y})`}>
    <rect
      className={"rountangle"
        +(props.selected.length===4?" selected":"")
        +((props.rountangle.kind==="or")?" or":"")}
      rx={20} ry={20}
      x={0}
      y={0}
      width={minSize.x}
      height={minSize.y}
      data-uid={uid}
      data-parts="left top right bottom"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("top")?" selected":"")}
      x1={0}
      y1={0}
      x2={minSize.x}
      y2={0}
      data-uid={uid}
      data-parts="top"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("right")?" selected":"")}
      x1={minSize.x}
      y1={0}
      x2={minSize.x}
      y2={minSize.y}
      data-uid={uid}
      data-parts="right"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("bottom")?" selected":"")}
      x1={0}
      y1={minSize.y}
      x2={minSize.x}
      y2={minSize.y}
      data-uid={uid}
      data-parts="bottom"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("left")?" selected":"")}
      x1={0}
      y1={0}
      x2={0}
      y2={minSize.y}
      data-uid={uid}
      data-parts="left"
    />

    <circle
      className="circleHelper corner"
      cx={cornerOffset}
      cy={cornerOffset}
      r={cornerRadius}
      data-uid={uid}
      data-parts="top left"
      />

    <circle
      className="circleHelper corner"
      cx={minSize.x-cornerOffset}
      cy={cornerOffset}
      r={cornerRadius}
      data-uid={uid}
      data-parts="top right"
      />

    <circle
      className="circleHelper corner"
      cx={minSize.x-cornerOffset}
      cy={minSize.y-cornerOffset}
      r={cornerRadius}
      data-uid={uid}
      data-parts="bottom right"
      />

    <circle
      className="circleHelper corner"
      cx={cornerOffset}
      cy={minSize.y-cornerOffset}
      r={cornerRadius}
      data-uid={uid}
      data-parts="bottom left"
      />



    <text x={10} y={20}>{uid}</text>
  </g>;
}

export function ArrowSVG(props: {arrow: Arrow, selected: string[]}) {
  const {start, end, uid} = props.arrow;
  return <g>
    <line
      className={"arrow"}
      markerEnd='url(#arrowEnd)'
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      data-uid={uid}
      data-parts="start end"
    />
    <line
      className="lineHelper"
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      data-uid={uid}
      data-parts="start end"
    />

    <circle
      className={"circleHelper"
        +(props.selected.includes("start")?" selected":"")}
      cx={start.x}
      cy={start.y}
      r={cornerRadius}
      data-uid={uid}
      data-parts="start"
    />
    <circle
      className={"circleHelper"
        +(props.selected.includes("end")?" selected":"")}
      cx={end.x}
      cy={end.y}
      r={cornerRadius}
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