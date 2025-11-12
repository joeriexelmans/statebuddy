import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useEffect, useRef } from "react";

import { Mode } from "@/statecharts/runtime_types";
import { arraysEqual, objectsEqual, setsEqual } from "@/util/util";
import { Arrow, ArrowPart, Diamond, History, RectSide, Rountangle, Text } from "../../statecharts/concrete_syntax";
import { Connections } from "../../statecharts/detect_connections";
import { TraceableError } from "../../statecharts/parser";
import { ArcDirection, arcDirection } from "../../util/geometry";
import { InsertMode } from "../TopPanel/InsertModes";
import { ArrowSVG } from "./ArrowSVG";
import { DiamondSVG } from "./DiamondSVG";
import { HistorySVG } from "./HistorySVG";
import { RountangleSVG } from "./RountangleSVG";
import { TextSVG } from "./TextSVG";
import "./VisualEditor.css";
import { useCopyPaste } from "./hooks/useCopyPaste";
import { useMouse } from "./hooks/useMouse";

export type ConcreteSyntax = {
  rountangles: Rountangle[];
  texts: Text[];
  arrows: Arrow[];
  diamonds: Diamond[];
  history: History[];
};

export type VisualEditorState = ConcreteSyntax & {
  nextID: number;
  selection: Selection;
};

export type RountangleSelectable = {
  // kind: "rountangle";
  parts: RectSide[];
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

export type Selection = Selectable[];

type VisualEditorProps = {
  state: VisualEditorState,
  setState: Dispatch<(v:VisualEditorState) => VisualEditorState>,
  conns: Connections,
  syntaxErrors: TraceableError[],
  // trace: TraceState | null,
  // activeStates: Set<string>,
  insertMode: InsertMode,
  highlightActive: Set<string>,
  highlightTransitions: string[],
  setModal: Dispatch<SetStateAction<ReactElement|null>>,
  makeCheckPoint: () => void;
  zoom: number;
};

export const VisualEditor = memo(function VisualEditor({state, setState, conns, syntaxErrors: errors, insertMode, highlightActive, highlightTransitions, setModal, makeCheckPoint, zoom}: VisualEditorProps) {

  // uid's of selected rountangles
  const selection = state.selection || [];

  const refSVG = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // bit of a hacky way to force the animation on fired transitions to replay, if the new 'rt' contains the same fired transitions as the previous one
    requestAnimationFrame(() => {
      document.querySelectorAll(".arrow.fired").forEach(el => {
        // @ts-ignore
        el.style.animation = 'none';
        requestAnimationFrame(() => {
          // @ts-ignore
          el.style.animation = ''; 
        })
      });
    })
  }, [highlightTransitions]);


  const {onCopy, onPaste, onCut, deleteSelection} = useCopyPaste(makeCheckPoint, state, setState, selection);

  const {onMouseDown, selectionRect} = useMouse(makeCheckPoint, insertMode, zoom, refSVG, state, setState, deleteSelection);


  // for visual feedback, when selecting/moving one thing, we also highlight (in green) all the things that belong to the thing we selected.
  const sidesToHighlight: {[key: string]: RectSide[]} = {};
  const arrowsToHighlight: {[key: string]: boolean} = {};
  const textsToHighlight: {[key: string]: boolean} = {};
  const rountanglesToHighlight: {[key: string]: boolean} = {};
  const historyToHighlight: {[key: string]: boolean} = {};
  for (const selected of selection) {
    const sides = conns.arrow2SideMap.get(selected.uid);
    if (sides) {
      const [startSide, endSide] = sides;
      if (startSide) sidesToHighlight[startSide.uid] = [...sidesToHighlight[startSide.uid]||[], startSide.part];
      if (endSide) sidesToHighlight[endSide.uid] = [...sidesToHighlight[endSide.uid]||[], endSide.part];
    }
    const texts = [
      ...(conns.arrow2TextMap.get(selected.uid) || []),
      ...(conns.rountangle2TextMap.get(selected.uid) || []),
    ];
    for (const textUid of texts) {
      textsToHighlight[textUid] = true;
    }
    for (const part of selected.parts) {
      const arrows = conns.side2ArrowMap.get(selected.uid + '/' + part) || [];
      if (arrows) {
        for (const [arrowPart, arrowUid] of arrows) {
          arrowsToHighlight[arrowUid] = true;
        }
      }
    }
    const arrow2 = conns.text2ArrowMap.get(selected.uid);
    if (arrow2) {
      arrowsToHighlight[arrow2] = true;
    }
    const rountangleUid = conns.text2RountangleMap.get(selected.uid)
    if (rountangleUid) {
      rountanglesToHighlight[rountangleUid] = true;
    }
    const history = conns.arrow2HistoryMap.get(selected.uid);
    if (history) {
      historyToHighlight[history] = true;
    }
    const arrow3 = conns.history2ArrowMap.get(selected.uid) || [];
    for (const arrow of arrow3) {
      arrowsToHighlight[arrow] = true;
    }
  }

  const onEditText = useCallback((text: Text, newText: string) => {
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
  }, [setState]);

  const rootErrors = errors.filter(({shapeUid}) => shapeUid === "root").map(({message}) => message);

  const size = 4000*zoom;

  return <svg width={size} height={size}
      className={"svgCanvas"+(highlightActive.has("root")?" active":"")/*+(dragging ? " dragging" : "")*/}
      onMouseDown={onMouseDown}
      onContextMenu={e => e.preventDefault()}
      ref={refSVG}

      viewBox={`0 0 4000 4000`}

      onCopy={onCopy}
      onPaste={onPaste}
      onCut={onCut}
    >
      <defs>
        <marker
          id="initialMarker"
          viewBox="0 0 9 9"
          refX="4.5"
          refY="4.5"
          markerWidth="9"
          markerHeight="9"
          markerUnits="userSpaceOnUse">
          <circle cx={4.5} cy={4.5} r={4.5}/>
        </marker>
        <marker
          id="arrowEnd"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z"/>
        </marker>
      </defs>

    {(rootErrors.length>0) && <text className="error" x={5} y={20}>{rootErrors.join(' ')}</text>}

    <Rountangles rountangles={state.rountangles} {...{selection, sidesToHighlight, rountanglesToHighlight, errors, highlightActive}}/>
    <Diamonds diamonds={state.diamonds} {...{selection, sidesToHighlight, rountanglesToHighlight, errors}}/>

    {state.history.map(history => <>
      <HistorySVG
        key={history.uid}
        selected={Boolean(selection.find(h => h.uid === history.uid))}
        highlight={Boolean(historyToHighlight[history.uid])}
        {...history}
        />
    </>)}

    {state.arrows.map(arrow => {
      const sides = conns.arrow2SideMap.get(arrow.uid);
      let arc = "no" as ArcDirection;
      if (sides && sides[0]?.uid === sides[1]?.uid && sides[0]!.uid !== undefined) {
        arc = arcDirection(sides[0]!.part, sides[1]!.part);
      }
      const initialMarker = sides && sides[0] === undefined && sides[1] !== undefined;
      return <ArrowSVG
        key={arrow.uid}
        arrow={arrow}
        selected={selection.find(a => a.uid === arrow.uid)?.parts as ArrowPart[] || []}
        error={errors
          .filter(({shapeUid}) => shapeUid === arrow.uid)
          .map(({message}) => message).join(', ')}
        highlight={arrowsToHighlight.hasOwnProperty(arrow.uid)}
        fired={highlightTransitions.includes(arrow.uid)}
        arc={arc}
        initialMarker={Boolean(initialMarker)}
        />;
      }
    )}

    <Texts texts={state.texts} {...{selection, textsToHighlight, errors, onEditText, setModal}}/>

    {selectionRect}
  </svg>;
});

const Rountangles = memo(function Rountangles({rountangles, selection, sidesToHighlight, rountanglesToHighlight, errors, highlightActive}: {rountangles: Rountangle[], selection: Selection, sidesToHighlight: {[key: string]: RectSide[]}, rountanglesToHighlight: {[key: string]: boolean}, errors: TraceableError[], highlightActive: Mode}) {
  return <>{rountangles.map(rountangle => {
    return <RountangleSVG
      key={rountangle.uid}
      rountangle={rountangle}
      selected={selection.find(r => r.uid === rountangle.uid)?.parts as RectSide[] || []}
      highlight={[...(sidesToHighlight[rountangle.uid] || []), ...(rountanglesToHighlight[rountangle.uid]?["left","right","top","bottom"]:[]) as RectSide[]]}
      error={errors
        .filter(({shapeUid}) => shapeUid === rountangle.uid)
        .map(({message}) => message).join(', ')}
      active={highlightActive.has(rountangle.uid)}
    />})}</>;
}, (p, n) => {
  return arraysEqual(p.rountangles, n.rountangles)
    && arraysEqual(p.selection, n.selection)
    && objectsEqual(p.sidesToHighlight, n.sidesToHighlight)
    && objectsEqual(p.rountanglesToHighlight, n.rountanglesToHighlight)
    && arraysEqual(p.errors, n.errors)
    && setsEqual(p.highlightActive, n.highlightActive);
});

const Diamonds = memo(function Diamonds({diamonds, selection, sidesToHighlight, rountanglesToHighlight, errors}: {diamonds: Diamond[], selection: Selection, sidesToHighlight: {[key: string]: RectSide[]}, rountanglesToHighlight: {[key: string]: boolean}, errors: TraceableError[]}) {
  return <>{diamonds.map(diamond => <>
    <DiamondSVG
      key={diamond.uid}
      diamond={diamond}
      selected={selection.find(r => r.uid === diamond.uid)?.parts as RectSide[] || []}
      highlight={[...(sidesToHighlight[diamond.uid] || []), ...(rountanglesToHighlight[diamond.uid]?["left","right","top","bottom"]:[]) as RectSide[]]}
      error={errors
        .filter(({shapeUid}) => shapeUid === diamond.uid)
        .map(({message}) => message).join(', ')}
      active={false}/>
  </>)}</>;
}, (p, n) => {
  return arraysEqual(p.diamonds, n.diamonds)
    && arraysEqual(p.selection, n.selection)
    && objectsEqual(p.sidesToHighlight, n.sidesToHighlight)
    && objectsEqual(p.rountanglesToHighlight, n.rountanglesToHighlight)
    && arraysEqual(p.errors, n.errors);
});

const Texts = memo(function Texts({texts, selection, textsToHighlight, errors, onEditText, setModal}: {texts: Text[], selection: Selection, textsToHighlight: {[key: string]: boolean}, errors: TraceableError[], onEditText: (text: Text, newText: string) => void, setModal: Dispatch<SetStateAction<ReactElement|null>>}) {
  return <>{texts.map(txt => {
    return <TextSVG
      key={txt.uid}
      error={errors.find(({shapeUid}) => txt.uid === shapeUid)}
      text={txt}
      selected={Boolean(selection.find(s => s.uid === txt.uid)?.parts?.length)}
      highlight={textsToHighlight.hasOwnProperty(txt.uid)}
      onEdit={onEditText}
      setModal={setModal}
    />
  })}</>;
}, (p, n) => {
  return arraysEqual(p.texts, n.texts)
    && arraysEqual(p.selection, n.selection)
    && objectsEqual(p.textsToHighlight, n.textsToHighlight)
    && arraysEqual(p.errors, n.errors)
    && p.onEditText === n.onEditText
    && p.setModal === n.setModal;
});

