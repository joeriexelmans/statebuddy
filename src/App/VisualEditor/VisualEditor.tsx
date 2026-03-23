import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useContext, useEffect, useMemo } from "react";

import { Mode } from "@/statecharts/runtime_types";
import { arraysEqual, mapsEqual, objectsEqual, setsEqual } from "@/util/util";
import { ArrowPart, Diamond, RectSide, Rountangle, Text } from "../../statecharts/concrete_syntax";
import { Topology } from "../../statecharts/detect_topology";
import { TraceableError } from "../../statecharts/parser";
import { ArcDirection, arcDirection } from "../../util/geometry";
import { EDITOR_HEIGHT, EDITOR_WIDTH } from "../parameters";
import { ArrowSVG } from "./ArrowSVG";
import { DiamondSVG } from "./DiamondSVG";
import { Grid } from "./Grid";
import { HistorySVG } from "./HistorySVG";
import { RountangleSVG } from "./RountangleSVG";
import { Selecting } from "./Selection";
import { TextSVG } from "./TextSVG";
import "./VisualEditor.css";
import styles from "./VisualEditor.module.css";
import { Selection, VisualEditorState } from "./VisualEditor.state";
import { DebugContext } from "./context/DebugContext";
import { EditorStuff } from "./hooks/useMouse";
import { ToolSelectState } from "../migrations/v1_types";
import { useDelayedEffect } from "../hooks/useDelay";
import { useDelayedMemo } from "../hooks/useDelayedMemo";

type VisualEditorProps = {
  state: VisualEditorState,
  setState: Dispatch<SetStateAction<VisualEditorState>>,
  topology: Topology,
  editorStuff: EditorStuff;
  syntaxErrors: TraceableError[],
  highlightActive: Set<string>,
  highlightTransitions: string[],
  setModal: Dispatch<SetStateAction<ReactElement|null>>,
  zoom: number;
  findText: string;
  mouseMap: ToolSelectState;
};

const viewBox = `0 0 ${EDITOR_WIDTH} ${EDITOR_HEIGHT}`;

export const VisualEditor = memo(function VisualEditor({state, setState, topology, syntaxErrors: errors, highlightActive, highlightTransitions, setModal, zoom, findText, editorStuff}: VisualEditorProps) {

  const {copyPasteCallbacks, dragging, onMouseDown, refSVG, renderSelection, selectingState} = editorStuff;

  // uid's of selected rountangles
  const selection = state.selection;

  useEffect(() => {
    // bit of a hacky way to force the animation on fired transitions to replay, if the new 'rt' contains the same fired transitions as the previous one
    requestAnimationFrame(() => {
      document.querySelectorAll(`.${styles.arrow}.${styles.fired}`).forEach(el => {
        // @ts-ignore
        el.style.animation = 'none';
        requestAnimationFrame(() => {
          // @ts-ignore
          el.style.animation = ''; 
        })
      });
    })
  }, [highlightTransitions]);

  // for visual feedback, when selecting/moving one thing, we also highlight (in green) all the things that belong to the thing we selected.
  const sidesToHighlight: {[key: string]: RectSide[]} = {};
  const arrowsToHighlight: {[key: string]: boolean} = {};
  const textsToHighlight: {[key: string]: boolean} = {};
  const rountanglesToHighlight: {[key: string]: boolean} = {};
  const historyToHighlight: {[key: string]: boolean} = {};
  for (const [selectedUid, parts] of selection.entries()) {
    const sides = topology.arrow2SideMap.get(selectedUid);
    if (sides) {
      const [startSide, endSide] = sides;
      if (startSide) sidesToHighlight[startSide.uid] = [...sidesToHighlight[startSide.uid]||[], startSide.part];
      if (endSide) sidesToHighlight[endSide.uid] = [...sidesToHighlight[endSide.uid]||[], endSide.part];
    }
    const texts = [
      ...(topology.arrow2TextMap.get(selectedUid) || []),
      ...(topology.rountangle2TextMap.get(selectedUid) || []),
    ];
    for (const textUid of texts) {
      textsToHighlight[textUid] = true;
    }
    for (const part of parts) {
      const arrows = topology.side2ArrowMap.get(selectedUid + '/' + part) || [];
      if (arrows) {
        for (const [arrowPart, arrowUid] of arrows) {
          arrowsToHighlight[arrowUid] = true;
        }
      }
    }
    const arrow2 = topology.text2ArrowMap.get(selectedUid);
    if (arrow2) {
      arrowsToHighlight[arrow2] = true;
    }
    const rountangleUid = topology.text2RountangleMap.get(selectedUid)
    if (rountangleUid) {
      rountanglesToHighlight[rountangleUid] = true;
    }
    const history = topology.arrow2HistoryMap.get(selectedUid);
    if (history) {
      historyToHighlight[history] = true;
    }
    const arrow3 = topology.history2ArrowMap.get(selectedUid) || [];
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

  const size = EDITOR_WIDTH*zoom;

  const debugContext = useContext(DebugContext);

  return <svg width={size} height={size}
      className={styles.svgCanvas
        + ' ' + (highlightActive.has("root") ? styles.active : "")
        + ' ' + (dragging ? styles.dragging : "")}

      // Prevent onMouseDown from firing twice upon right click:
      onMouseDown={e => e.button !== 2 && onMouseDown(e)}

      // We prefer to handle right click with onContextMenu, because then we can cancel the context menu if the right mouse button is mapped to a tool:
      onContextMenu={onMouseDown}
      
      ref={refSVG}
      onCopy={copyPasteCallbacks.onCopy}
      onPaste={copyPasteCallbacks.onPaste}
      onCut={copyPasteCallbacks.onCut}
      viewBox={viewBox}
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
    <style>{`
      #arrowEnd {
        fill: context-stroke;
      }
      #initialMarker {
        fill: context-stroke;
      }
    `}</style>

    <Rountangles rountangles={state.rountangles} topology={topology} {...{selection: renderSelection, sidesToHighlight, rountanglesToHighlight, errors, highlightActive}}/>
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
      const sides = topology.arrow2SideMap.get(arrow.uid);
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

    {(rootErrors.length>0) && <text className={styles.errorHover} x={5} y={20} style={{display:'inline'}}>{rootErrors.join('\n')}</text>}

    {debugContext.showGrid && <Grid width={EDITOR_WIDTH} height={EDITOR_HEIGHT} />}

    {selectingState && <Selecting {...selectingState}/>}
  </svg>;
});

const Rountangles = memo(function Rountangles({rountangles, topology, selection, sidesToHighlight, rountanglesToHighlight, errors, highlightActive}: {rountangles: Rountangle[], topology: Topology, selection: Selection, sidesToHighlight: {[key: string]: RectSide[]}, rountanglesToHighlight: {[key: string]: boolean}, errors: TraceableError[], highlightActive: Mode}) {
  // dirty:
  const uidToRect = useDelayedMemo(() =>
    new Map(rountangles.map(r => [r.uid ,r])),
  [rountangles], 100);
  return <>{rountangles.map(rountangle => {
    const parentUID = topology.insidenessMap.get(rountangle.uid);
    const parent = uidToRect.get(parentUID!);
    const parentIsOrState = parent ? (parent.kind === "or") : true;
    return <RountangleSVG
      key={rountangle.uid}
      rountangle={rountangle}
      selected={selection.get(rountangle.uid) as Set<RectSide> || new Set()}
      highlight={[...(sidesToHighlight[rountangle.uid] || []), ...(rountanglesToHighlight[rountangle.uid]?["left","right","top","bottom"]:[]) as RectSide[]]}
      error={errors
        .filter(({shapeUid}) => shapeUid === rountangle.uid)
        .map(({message}) => message).join(', ')}
      active={highlightActive.has(rountangle.uid)}
      dashed={!parentIsOrState}
    />})}</>;
}, (p, n) => {
  return arraysEqual(p.rountangles, n.rountangles)
    && mapsEqual(p.topology.insidenessMap, n.topology.insidenessMap)
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

