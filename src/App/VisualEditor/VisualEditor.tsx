import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Mode } from "@/statecharts/runtime_types";
import { arraysEqual, mapsEqual, objectsEqual, setsEqual } from "@/util/util";
import { ArrowPart, ConcreteSyntax, Diamond, RectSide, Rountangle, Text } from "../../statecharts/concrete_syntax";
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
import { Grid } from "./Grid";
import { DebugContext } from "./context/DebugContext";

export type VisualEditorState = ConcreteSyntax & {
  nextID: number;
  selection: Selection;
};

export function json2EditorState(json: {selection: [string, string][]}) {
  const selection = new Selection();
  for (const [uid, part] of json.selection) {
    selection.set(uid, (selection.get(uid) || new Parts()).add(part));
  }
  return {
    ...json,
    selection,
  }
}

export class Selection extends Map<string, Parts> {
  toJSON() {
    // we still serialize to our old format, to remain compatible
    return [...this.entries()].flatMap(([uid, parts]) => [...parts].map(part => [uid, part]));
  }
}

export class Parts extends Set<string> {}

type VisualEditorProps = {
  state: VisualEditorState,
  commitState: Dispatch<(v:VisualEditorState) => VisualEditorState>,
  replaceState: Dispatch<(v:VisualEditorState) => VisualEditorState>,
  conns: Connections,
  syntaxErrors: TraceableError[],
  insertMode: InsertMode,
  highlightActive: Set<string>,
  highlightTransitions: string[],
  setModal: Dispatch<SetStateAction<ReactElement|null>>,
  zoom: number;
  findText: string;
};

export const VisualEditor = memo(function VisualEditor({state, commitState, replaceState, conns, syntaxErrors: errors, insertMode, highlightActive, highlightTransitions, setModal, zoom, findText}: VisualEditorProps) {

  // While dragging, the editor is in a temporary state (a state that is not committed to the edit history). If the temporary state is not null, then this state will be what you see.
  // const [temporaryState, setTemporaryState] = useState<VisualEditorState | null>(null);

  // const state = temporaryState || committedState;

  // uid's of selected rountangles
  const selection = state.selection;

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


  const {onMouseDown, selectionRect, newSelection, dragging, setDragging, cursorPos} = useMouse(insertMode, zoom, refSVG,
    state,
    commitState,
    replaceState);

  const startDragging = useCallback(() => setDragging(cursorPos), [setDragging, cursorPos]);
    
  const {onCopy, onPaste, onCut} = useCopyPaste(state, commitState, selection, startDragging, cursorPos);

  // for visual feedback, when selecting/moving one thing, we also highlight (in green) all the things that belong to the thing we selected.
  const sidesToHighlight: {[key: string]: RectSide[]} = {};
  const arrowsToHighlight: {[key: string]: boolean} = {};
  const textsToHighlight: {[key: string]: boolean} = {};
  const rountanglesToHighlight: {[key: string]: boolean} = {};
  const historyToHighlight: {[key: string]: boolean} = {};
  for (const [selectedUid, parts] of selection.entries()) {
    const sides = conns.arrow2SideMap.get(selectedUid);
    if (sides) {
      const [startSide, endSide] = sides;
      if (startSide) sidesToHighlight[startSide.uid] = [...sidesToHighlight[startSide.uid]||[], startSide.part];
      if (endSide) sidesToHighlight[endSide.uid] = [...sidesToHighlight[endSide.uid]||[], endSide.part];
    }
    const texts = [
      ...(conns.arrow2TextMap.get(selectedUid) || []),
      ...(conns.rountangle2TextMap.get(selectedUid) || []),
    ];
    for (const textUid of texts) {
      textsToHighlight[textUid] = true;
    }
    for (const part of parts) {
      const arrows = conns.side2ArrowMap.get(selectedUid + '/' + part) || [];
      if (arrows) {
        for (const [arrowPart, arrowUid] of arrows) {
          arrowsToHighlight[arrowUid] = true;
        }
      }
    }
    const arrow2 = conns.text2ArrowMap.get(selectedUid);
    if (arrow2) {
      arrowsToHighlight[arrow2] = true;
    }
    const rountangleUid = conns.text2RountangleMap.get(selectedUid)
    if (rountangleUid) {
      rountanglesToHighlight[rountangleUid] = true;
    }
    const history = conns.arrow2HistoryMap.get(selectedUid);
    if (history) {
      historyToHighlight[history] = true;
    }
    const arrow3 = conns.history2ArrowMap.get(selectedUid) || [];
    for (const arrow of arrow3) {
      arrowsToHighlight[arrow] = true;
    }
  }

  const onEditText = useCallback((text: Text, newText: string) => {
    if (newText === "") {
      // delete text node
      commitState(state => ({
        ...state,
        texts: state.texts.filter(t => t.uid !== text.uid),
      }));
    }
    else {
      commitState(state => ({
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
  }, [commitState]);

  const rootErrors = errors.filter(({shapeUid}) => shapeUid === "root").map(({message}) => message);

  const size = 4000*zoom;

  const debugContext = useContext(DebugContext);

  const renderSelection = new Selection([...selection, ...newSelection]);

  return <svg width={size} height={size}
      className={"svgCanvas"+(highlightActive.has("root")?" active":"")+(dragging?" dragging":"")}
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

    <Rountangles rountangles={state.rountangles} {...{selection: renderSelection, sidesToHighlight, rountanglesToHighlight, errors, highlightActive}}/>
    <Diamonds diamonds={state.diamonds} {...{selection: renderSelection, sidesToHighlight, rountanglesToHighlight, errors}}/>

    {state.history.map(history => <>
      <HistorySVG
        key={history.uid}
        selected={renderSelection.has(history.uid)}
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
        selected={renderSelection.get(arrow.uid) as Set<ArrowPart> || new Set()}
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

    <Texts texts={state.texts} {...{selection: renderSelection, textsToHighlight, errors, onEditText, setModal, findText}}/>

    {(rootErrors.length>0) && <text className="errorHover" x={5} y={20} style={{display:'inline'}}>{rootErrors.join('\n')}</text>}

    {debugContext.showGrid && <Grid width={4000} height={4000} />}

    {selectionRect}
  </svg>;
});

const Rountangles = memo(function Rountangles({rountangles, selection, sidesToHighlight, rountanglesToHighlight, errors, highlightActive}: {rountangles: Rountangle[], selection: Selection, sidesToHighlight: {[key: string]: RectSide[]}, rountanglesToHighlight: {[key: string]: boolean}, errors: TraceableError[], highlightActive: Mode}) {
  return <>{rountangles.map(rountangle => {
    return <RountangleSVG
      key={rountangle.uid}
      rountangle={rountangle}
      selected={selection.get(rountangle.uid) as Set<RectSide> || new Set()}
      highlight={[...(sidesToHighlight[rountangle.uid] || []), ...(rountanglesToHighlight[rountangle.uid]?["left","right","top","bottom"]:[]) as RectSide[]]}
      error={errors
        .filter(({shapeUid}) => shapeUid === rountangle.uid)
        .map(({message}) => message).join(', ')}
      active={highlightActive.has(rountangle.uid)}
    />})}</>;
}, (p, n) => {
  return arraysEqual(p.rountangles, n.rountangles)
    && mapsEqual(p.selection, n.selection)
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
      selected={selection.get(diamond.uid) as Set<RectSide> || new Set()}
      highlight={[...(sidesToHighlight[diamond.uid] || []), ...(rountanglesToHighlight[diamond.uid]?["left","right","top","bottom"]:[]) as RectSide[]]}
      error={errors
        .filter(({shapeUid}) => shapeUid === diamond.uid)
        .map(({message}) => message).join(', ')}
      active={false}/>
  </>)}</>;
}, (p, n) => {
  return arraysEqual(p.diamonds, n.diamonds)
    && mapsEqual(p.selection, n.selection)
    && objectsEqual(p.sidesToHighlight, n.sidesToHighlight)
    && objectsEqual(p.rountanglesToHighlight, n.rountanglesToHighlight)
    && arraysEqual(p.errors, n.errors);
});

const Texts = memo(function Texts({texts, selection, textsToHighlight, errors, onEditText, setModal, findText}: {texts: Text[], selection: Selection, textsToHighlight: {[key: string]: boolean}, errors: TraceableError[], onEditText: (text: Text, newText: string) => void, setModal: Dispatch<SetStateAction<ReactElement|null>>, findText: string}) {
  return <>{texts.map(txt => {
    return <TextSVG
      key={txt.uid}
      error={errors.find(({shapeUid}) => txt.uid === shapeUid)}
      text={txt}
      selected={selection.has(txt.uid)}
      highlight={textsToHighlight.hasOwnProperty(txt.uid)}
      onEdit={onEditText}
      setModal={setModal}
      findText={findText}
    />
  })}</>;
}, (p, n) => {
  return arraysEqual(p.texts, n.texts)
    && mapsEqual(p.selection, n.selection)
    && objectsEqual(p.textsToHighlight, n.textsToHighlight)
    && arraysEqual(p.errors, n.errors)
    && p.onEditText === n.onEditText
    && p.setModal === n.setModal
    && p.findText === n.findText;
});

