import "../index.css";
import "./App.css";

import { ReactElement, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { connectionsEqual, detectConnections, reducedConcreteSyntaxEqual } from "@/statecharts/detect_connections";
import { parseStatechart } from "../statecharts/parser";
import { BottomPanel, BottomPanelState, defaultBottomPanelState } from "./BottomPanel/BottomPanel";
import { defaultSideBarState, SideBar, SideBarState } from "./SideBar/SideBar";
import { InsertMode } from "./TopPanel/InsertModes";
import { TopPanel } from "./TopPanel/TopPanel";
import { VisualEditor, VisualEditorState } from "./VisualEditor/VisualEditor";
import { makeAllSetters } from "./makePartialSetter";
import { useEditor } from "./hooks/useEditor";
import { useSimulator } from "./hooks/useSimulator";
import { useUrlHashState } from "../hooks/useUrlHashState";
import { plants } from "./plants";
import { initialEditorState } from "@/statecharts/concrete_syntax";
import { ModalOverlay } from "./Overlays/ModalOverlay";
import { FindReplace } from "./BottomPanel/FindReplace";
import { useCustomMemo } from "@/hooks/useCustomMemo";
import { defaultPlotState, Plot, PlotState } from "./Plot/Plot";
import { prepareTrace } from "./SideBar/check_property";
import { useDisplayTime } from "@/hooks/useDisplayTime";
import { Greeter } from "./BottomPanel/Greeter";
import { PersistentDetails } from "./Components/PersistentDetails";

export type EditHistory = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

export type AppState = {
  modelName: string,
  showKeys: boolean,
  zoom: number,
  insertMode: InsertMode,
  showFindReplace: boolean,
  findText: string,
  replaceText: string,
  showPlot: boolean,
} & PlotState & SideBarState & BottomPanelState;

export const defaultAppState: AppState = {
  modelName: "untitled",
  showKeys: true,
  zoom: 1,
  insertMode: 'and',
  showFindReplace: false,
  findText: "",
  replaceText: "",
  showPlot: false,
  ...defaultSideBarState,
  ...defaultPlotState,
  ...defaultBottomPanelState,
}

export type LightMode = "light" | "auto" | "dark";

export function App() {
  const [editHistory, setEditHistory] = useState<EditHistory|null>(null);
  const [modal, setModal] = useState<ReactElement|null>(null);

  const {commitState, replaceState, onRedo, onUndo, onRotate} = useEditor(setEditHistory);

  const editorState = editHistory && editHistory.current;
  const setEditorState = useCallback((cb: (value: VisualEditorState) => VisualEditorState) => {
    setEditHistory(historyState => historyState && ({...historyState, current: cb(historyState.current)}));
  }, [setEditHistory]);

  // parse concrete syntax always:
  const conns = useMemo(() => editorState && detectConnections(editorState), [editorState]);
  const parsed = useCustomMemo(() => editorState && conns && parseStatechart(editorState, conns),
  [editorState, conns] as const,
  // only parse again if anything changed to the connectedness / insideness...
  // parsing is fast, BUT re-rendering everything that depends on the AST is slow, and it's difficult to check if the AST changed because AST objects have recursive structure.
  ([prevState, prevConns], [nextState, nextConns]) => {
    if ((prevState === null) !== (nextState === null)) return false;
    if ((prevConns === null) !== (nextConns === null)) return false;
    if (prevConns === null) {
      return nextConns === null;
    }
    if (prevState === null) {
      return nextState === null;
    }
    if (nextConns === null) return false;
    if (nextState === null) return false;
    // the following check is much cheaper than re-rendering everything that depends on
    return connectionsEqual(prevConns, nextConns)
      && reducedConcreteSyntaxEqual(prevState, nextState);
  });
  const ast = parsed && parsed[0];

  const [appState, setAppState] = useState<AppState>(defaultAppState);

  useEffect(() => {
    // useful when bookmarking the page: model name is in the title (that's basically the only reason we have a model name)
    const leadingZeros = (n: number) => ('0'+n).slice(-2);
    const now = new Date();
    const timeFormatted = `${now.getFullYear()}/${leadingZeros(now.getMonth()+1)}/${leadingZeros(now.getDay()+1)} ${leadingZeros(now.getHours())}:${leadingZeros(now.getMinutes())}`;
    document.title = `${location.hostname==="localhost"?"[dev] ":""}${appState.modelName} [StateBuddy] ${timeFormatted}`;
  }, [appState])

  const persist = useUrlHashState<VisualEditorState | AppState & {editorState: VisualEditorState}>(
    recoveredState => {
      if (recoveredState === null) {
        setEditHistory(() => ({current: initialEditorState, history: [], future: []}));
      }
      // we support two formats
      // @ts-ignore
      else if (recoveredState.nextID) {
        // old format
        setEditHistory(() => ({current: recoveredState as VisualEditorState, history: [], future: []}));
      }
      else {
        // new format
        // @ts-ignore
        if (recoveredState.editorState !== undefined) {
          const {editorState, ...appState} = recoveredState as AppState & {editorState: VisualEditorState};
          setEditHistory(() => ({current: editorState, history: [], future: []}));
          setAppState(defaultAppState => Object.assign({}, defaultAppState, appState));
        }          
      }
    },
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (editorState !== null) {
        console.log('persisting state to url');
        persist({editorState, ...appState});
      }
    }, 1);
    return () => clearTimeout(timeout);
  }, [editorState, appState]);

  const {
    autoScroll,
    plantConns,
    plantName,
  } = appState;

  const [_, plant, plantCS] = plants.find(([pn, p]) => pn === plantName)!;

  const refRightSideBar = useRef<HTMLDivElement>(null);
  const scrollDownSidebar = useCallback(() => {
    if (autoScroll && refRightSideBar.current) {
      const el = refRightSideBar.current;
      // hack: we want to scroll to the new element, but we have to wait until it is rendered...
      setTimeout(() => {
        el.scrollIntoView({block: "end", behavior: "smooth"});
      }, 50);
    }
  }, [refRightSideBar.current, autoScroll]);

  const simulator = useSimulator(ast, plant, plantConns, scrollDownSidebar);
  const {displayTime, refreshDisplayTime} = useDisplayTime(simulator.time);
  
  const setters = makeAllSetters(setAppState, Object.keys(appState) as (keyof AppState)[]);

  const setFindReplaceText = useCallback((callback: SetStateAction<[string, string]>) => {
    setAppState(appState => {
      let findText, replaceText;
      if (typeof callback === 'function') {
        [findText, replaceText] = callback([appState.findText, appState.replaceText]);
      }
      else {
        [findText, replaceText] = callback;
      }
      return {
        ...appState,
        findText,
        replaceText,
      }
    })
  }, [setAppState]);

  const syntaxErrors = parsed && parsed[1] || [];
  const currentTraceItem = simulator.trace && simulator.trace.trace[simulator.trace.idx];
  const currentBigStep = currentTraceItem && currentTraceItem.kind === "bigstep" && currentTraceItem;
  const allErrors = [
    ...syntaxErrors,
    ...(currentTraceItem && currentTraceItem.kind === "error") ? currentTraceItem.error.highlight.map(uid => ({
      message: currentTraceItem.error.message,
      shapeUid: uid,
    })) : [],
  ];
  const highlightActive = (currentBigStep && currentBigStep.state.sc.mode) || new Set();
  const highlightTransitions = currentBigStep && currentBigStep.state.sc.firedTransitions || [];

  const plantState = useMemo(() =>
    currentBigStep && currentBigStep.state.plant || plant.execution.initial()[1],
  [currentBigStep, plant]);

  const preparedTraces = useMemo(() => simulator.trace && prepareTrace(plant, simulator.trace.trace), [simulator.trace, plant]);

  return <div style={{
    height: '100%',
  }}>
    <ModalOverlay modal={modal} setModal={setModal}>
      {/* top-to-bottom: everything -> bottom panel */}
      <div className="stackVertical" style={{height:'100%'}}>

        {/* left-to-right: main -> sidebar */}
        <div className="stackHorizontal" style={{flexGrow:1, overflow: "auto"}}>

          {/* top-to-bottom: top bar, editor */}
          <div className="stackVertical" style={{flexGrow:1, overflow: "hidden"}}>
            {/* Top bar */}
            <div
              className="shadowBelow"
              style={{flex: '0 0 content'}}
            >
              {editHistory && <TopPanel
                {...{onUndo, onRedo, onRotate, setModal, editHistory, ...simulator, ...setters, ...appState, setEditorState, displayTime, refreshDisplayTime}}
              />}
            </div>
            {/* Editor */}
            <div style={{flexGrow: 1, overflow: "auto"}}>
              {editorState && conns && syntaxErrors &&
                <VisualEditor {...{state: editorState, commitState, replaceState, conns, syntaxErrors: allErrors, highlightActive, highlightTransitions, setModal, ...appState, findText: appState.showFindReplace ? appState.findText : ""}}/>}
            </div>
            
            {editorState && appState.showFindReplace &&
              <div style={{}}>
                <FindReplace
                  {...appState}
                  setFindReplaceText={setFindReplaceText}
                  cs={editorState}
                  setCS={setEditorState}
                  hide={() => setters.setShowFindReplace(false)}/>
              </div>
            }

          </div>

          {/* Right: sidebar */}
          <div style={{
            flex: '0 0 content',
            borderLeft: '1px solid var(--separator-color)',
            overflowY: "auto",
            overflowX: "auto",
            maxWidth: 'min(400px, 50vw)',
          }}>
            <div className="stackVertical" style={{height:'100%'}}>
              <SideBar {...{...appState, refRightSideBar, ast, preparedTraces, plantCS, plantState, ...simulator, ...setters}} />
            </div>
          </div>
        </div>

        {/* Bottom panel */}
        <div style={{flex: '0 0 content', borderTop: '1px solid var(--separator-color'}}>
          <Greeter/>
          <div className="statusBar">
            <PersistentDetails state={appState.showPlot} setState={setters.setShowPlot}>
              <summary>plot</summary>
              {preparedTraces &&
                <Plot width="100%" traces={preparedTraces} displayTime={displayTime} nextWakeup={simulator.nextWakeup} {...appState} {...setters} />}
            </PersistentDetails>
          </div>
          {syntaxErrors && <BottomPanel {...{errors: syntaxErrors, ...appState, setEditorState, ...setters}}/>}
        </div>
      </div>
    </ModalOverlay>
  </div>;
}

export default App;
