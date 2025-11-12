import "../index.css";
import "./App.css";

import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { detectConnections } from "@/statecharts/detect_connections";
import { parseStatechart } from "../statecharts/parser";
import { BottomPanel } from "./BottomPanel/BottomPanel";
import { defaultSideBarState, SideBar, SideBarState } from "./SideBar/SideBar";
import { InsertMode } from "./TopPanel/InsertModes";
import { TopPanel } from "./TopPanel/TopPanel";
import { VisualEditor, VisualEditorState } from "./VisualEditor/VisualEditor";
import { makeAllSetters } from "./makePartialSetter";
import { useEditor } from "./hooks/useEditor";
import { useSimulator } from "./hooks/useSimulator";
import { useUrlHashState } from "../hooks/useUrlHashState";
import { plants } from "./plants";
import { emptyState } from "@/statecharts/concrete_syntax";
import { ModalOverlay } from "./Modals/ModalOverlay";

export type EditHistory = {
  current: VisualEditorState,
  history: VisualEditorState[],
  future: VisualEditorState[],
}

export type AppState = {
  showKeys: boolean,
  zoom: number,
  insertMode: InsertMode,
} & SideBarState;

const defaultAppState: AppState = {
  showKeys: true,
  zoom: 1,
  insertMode: 'and',

  ...defaultSideBarState,
}

export function App() {
  const [editHistory, setEditHistory] = useState<EditHistory|null>(null);
  const [modal, setModal] = useState<ReactElement|null>(null);

  const {makeCheckPoint, onRedo, onUndo, onRotate} = useEditor(setEditHistory);

  const editorState = editHistory && editHistory.current;
  const setEditorState = useCallback((cb: (value: VisualEditorState) => VisualEditorState) => {
    setEditHistory(historyState => historyState && ({...historyState, current: cb(historyState.current)}));
  }, [setEditHistory]);

  // parse concrete syntax always:
  const conns = useMemo(() => editorState && detectConnections(editorState), [editorState]);
  const parsed = useMemo(() => editorState && conns && parseStatechart(editorState, conns), [editorState, conns]);
  const ast = parsed && parsed[0];

  const [appState, setAppState] = useState<AppState>(defaultAppState);

  const persist = useUrlHashState<VisualEditorState | AppState & {editorState: VisualEditorState}>(
    recoveredState => {
      if (recoveredState === null) {
        setEditHistory(() => ({current: emptyState, history: [], future: []}));
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
    }, 100);
    return () => clearTimeout(timeout);
  }, [editorState, appState]);

  const {
    autoScroll,
    plantConns,
    plantName,
  } = appState;

  const plant = plants.find(([pn, p]) => pn === plantName)![1];

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
  
  // console.log('render app', {ast, plant, appState});
  // useDetectChange(ast, 'ast');
  // useDetectChange(plant, 'plant');
  // useDetectChange(scrollDownSidebar, 'scrollDownSidebar');
  // useDetectChange(appState, 'appState');
  // useDetectChange(simulator.time, 'simulator.time');
  // useDetectChange(simulator.trace, 'simulator.trace');

  const setters = makeAllSetters(setAppState, Object.keys(appState) as (keyof AppState)[]);

  const syntaxErrors = parsed && parsed[1] || [];
  const currentTraceItem = simulator.trace && simulator.trace.trace[simulator.trace.idx];
  const currentBigStep = currentTraceItem && currentTraceItem.kind === "bigstep" && currentTraceItem;
  const allErrors = [
    ...syntaxErrors,
    ...(currentTraceItem && currentTraceItem.kind === "error") ? [{
      message: currentTraceItem.error.message,
      shapeUid: currentTraceItem.error.highlight[0],
    }] : [],
  ];
  const highlightActive = (currentBigStep && currentBigStep.state.sc.mode) || new Set();
  const highlightTransitions = currentBigStep && currentBigStep.state.sc.firedTransitions || [];

  const plantState = currentBigStep && currentBigStep.state.plant || plant.execution.initial()[1];

  return <ModalOverlay modal={modal} setModal={setModal}>
    {/* top-to-bottom: everything -> bottom panel */}
    <div className="stackVertical" style={{height:'100%'}}>

      {/* left-to-right: main -> sidebar */}
      <div className="stackHorizontal" style={{flexGrow:1, overflow: "auto"}}>

        {/* top-to-bottom: top bar, editor */}
        <div className="stackVertical" style={{flexGrow:1, overflow: "auto"}}>
          {/* Top bar */}
          <div
            className="shadowBelow"
            style={{flex: '0 0 content'}}
          >
            {editHistory && <TopPanel
              {...{onUndo, onRedo, onRotate, setModal, editHistory, ...simulator, ...setters, ...appState}}
            />}
          </div>
          {/* Editor */}
          <div style={{flexGrow: 1, overflow: "auto"}}>
            {editorState && conns && syntaxErrors &&
              <VisualEditor {...{state: editorState, setState: setEditorState, conns, syntaxErrors: allErrors, highlightActive, highlightTransitions, setModal, makeCheckPoint, ...appState}}/>}
          </div>
        </div>

        {/* Right: sidebar */}
        <div style={{
          flex: '0 0 content',
          borderLeft: '1px solid lightgrey',
          overflowY: "auto",
          overflowX: "auto",
          maxWidth: 'min(400px, 50vw)',
        }}>
          <div className="stackVertical" style={{height:'100%'}}>
            <SideBar {...{...appState, refRightSideBar, ast, plantState, ...simulator, ...setters}} />
          </div>
        </div>
      </div>

      {/* Bottom panel */}
      <div style={{flex: '0 0 content'}}>
        {syntaxErrors && <BottomPanel {...{errors: syntaxErrors}}/>}
      </div>
    </div>
  </ModalOverlay>;
}

export default App;

