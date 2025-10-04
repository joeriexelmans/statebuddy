import { MouseEventHandler, useEffect, useRef, useState } from "react";
import { Line2D, Rect2D, Vec2D, addV2D, area, isEntirelyWithin, normalizeRect, scaleV2D, subtractV2D, transformLine, transformRect } from "./geometry";

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
  kind: "rountangle";
  parts: RountanglePart[];
  uid: string;
}
type ArrowSelectable = {
  kind: "arrow";
  parts: ArrowPart[];
  uid: string;
}
type Selectable = RountangleSelectable | ArrowSelectable;
type Selection = Selectable[];

const minStateSize = {x: 40, y: 40};

export function VisualEditor() {
  const [state, setState] = useState<VisualEditorState>(onOffStateMachine);
  const [dragging, setDragging] = useState<DraggingState>(null);

  const [mode, setMode] = useState<"state"|"transition"|"text">("state");

  const [showHelp, setShowHelp] = useState<boolean>(true);

  // uid's of selected rountangles
  const [selection, setSelection] = useState<Selection>([]);

  // not null while the user is making a selection
  const [selectingState, setSelectingState] = useState<SelectingState>(null);

  const refSVG = useRef<SVGSVGElement>(null);

  // useEffect(() => {
  //   console.log('selection:', selection);
  // }, [selection]);
  // useEffect(() => {
  //   console.log('state:', state);
  // }, [state]);
  // useEffect(() => {
  //   console.log('selectingState:', selectingState);
  // }, [selectingState]);



  const onMouseDown: MouseEventHandler<SVGSVGElement> = (e) => {
    console.log(e);
    const currentPointer = {x: e.clientX, y: e.clientY};

    if (e.button === 1) {
      // ignore selection, middle mouse button always inserts
      setState(state => {
        const newID = state.nextID.toString();
        setSelection([{uid: newID, parts: ["bottom", "right"]}]);
        setDragging({
          lastMousePos: currentPointer,
        });
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
      });
      return;
    }

    if (e.button === 0) {
      // left mouse button on a shape will drag that shape (and everything else that's selected). if the shape under the pointer was not in the selection then the selection is reset to contain only that shape.
      const uid = e.target?.dataset.uid;
      const parts: string[] = e.target?.dataset.parts?.split(' ') || [];
      if (uid) {
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
    const currentPointer = {x: e.clientX, y: e.clientY};
    if (dragging) {
      setDragging(prevDragState => {
        const pointerDelta = subtractV2D(currentPointer, dragging.lastMousePos);
        const halfPointerDelta = scaleV2D(pointerDelta, 0.5);
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
              ...transformRect(r, parts, halfPointerDelta),
            };
          }),
          arrows: state.arrows.map(a => {
            const parts = selection.find(selected => selected.uid === a.uid)?.parts || [];
            if (parts.length === 0) {
              return a;
            }
            return {
              uid: a.uid,
              ...transformLine(a, parts, halfPointerDelta),
            }
          })
        }));
        return {lastMousePos: currentPointer};
      });
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
    setDragging(null);
    setSelectingState(ss => {
      if (ss) {
        // we were making a selection
        const normalizedSS = normalizeRect(ss);

        const shapes = Array.from(refSVG.current?.querySelectorAll("rect, line, circle") || []) as SVGGraphicsElement[];

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
      }
      return null; // no longer selecting
    });
    // sort: smaller rountangles are drawn on top
    setState(state => ({
      ...state,
      rountangles: state.rountangles.toSorted((a,b) => area(b) - area(a)),
    }));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Delete") {
      // delete selection
      setSelection(selection => {
        setState(state => ({
          ...state,
          rountangles: state.rountangles.filter(r => !selection.some(rs => rs.uid === r.uid)),
        }));
        return [];
      });
    }
    if (e.key === "o") {
      console.log('turn selected states into OR-states...');
      // selected states become OR-states
      setSelection(selection => {
        setState(state => ({
          ...state,
          rountangles: state.rountangles.map(r => selection.includes(r.uid) ? ({...r, kind: "or"}) : r),
        }));
        return selection;
      })
    }
    if (e.key === "a") {
      // selected states become AND-states
      setSelection(selection => {
        setState(state => ({
          ...state,
          rountangles: state.rountangles.map(r => selection.includes(r.uid) ? ({...r, kind: "and"}) : r),
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

  return <svg width="100%" height="100%"
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
      dragging={(dragging!==null) && selection.includes(rountangle.uid)}
      selected={selection.find(r => r.uid === rountangle.uid)?.parts || []}
      />)}

    {state.arrows.map(arrow => <ArrowSVG
      key={arrow.uid}
      arrow={arrow}
      dragging={(dragging!==null) && selection.includes(arrow.uid)}
      selected={selection.find(a => a.uid === arrow.uid)?.parts || []}
      />
    )}

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

export function RountangleSVG(props: {rountangle: Rountangle, dragging: boolean, selected: string[]}) {
  const {topLeft, size, uid} = props.rountangle;
  return <g transform={`translate(${topLeft.x} ${topLeft.y})`}>
    <rect
      className={"rountangle"
        +(props.dragging?" dragging":"")
        // +(props.selected.length===4?" selected":"")
        +((props.rountangle.kind==="or")?" or":"")}
      rx={20} ry={20}
      x={0}
      y={0}
      width={size.x}
      height={size.y}
      data-uid={uid}
      data-parts="left top right bottom"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("top")?" selected":"")}
      x1={0}
      y1={0}
      x2={size.x}
      y2={0}
      data-uid={uid}
      data-parts="top"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("right")?" selected":"")}
      x1={size.x}
      y1={0}
      x2={size.x}
      y2={size.y}
      data-uid={uid}
      data-parts="right"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("bottom")?" selected":"")}
      x1={0}
      y1={size.y}
      x2={size.x}
      y2={size.y}
      data-uid={uid}
      data-parts="bottom"
    />
    <line
      className={"lineHelper"
        +(props.selected.includes("left")?" selected":"")}
      x1={0}
      y1={0}
      x2={0}
      y2={size.y}
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
      cx={size.x-cornerOffset}
      cy={cornerOffset}
      r={cornerRadius}
      data-uid={uid}
      data-parts="top right"
      />

    <circle
      className="circleHelper corner"
      cx={size.x-cornerOffset}
      cy={size.y-cornerOffset}
      r={cornerRadius}
      data-uid={uid}
      data-parts="bottom right"
      />

    <circle
      className="circleHelper corner"
      cx={cornerOffset}
      cy={size.y-cornerOffset}
      r={cornerRadius}
      data-uid={uid}
      data-parts="bottom left"
      />



    <text x={10} y={20}>{uid}</text>
  </g>;
}

export function ArrowSVG(props: {arrow: Arrow, dragging: boolean, selected: string[]}) {
  const {start, end, uid} = props.arrow;
  return <g>
    <line
      className={"arrow"
        +(props.dragging?" dragging":"")
        // +(props.selected.length===2?" selected":"")
      }
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