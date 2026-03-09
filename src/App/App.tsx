import styles from "./App.module.css";

import { PropsWithChildren, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDisplayTime } from "@/hooks/useDisplayTime";
import { formatDateTime } from "@/util/util";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { usePersistentAppState } from "./hooks/usePersistentAppState";
import { AppState, defaultAppState } from "./App.state";
import { BottomPanel } from "./BottomPanel/BottomPanel";
import { DebugPanel, DebugState } from "./BottomPanel/Debug";
import { FindReplace } from "./BottomPanel/FindReplace";
import { Greeter } from "./BottomPanel/Greeter";
import { Plot } from "./BottomPanel/Plot";
import { PropertyTraceTable } from "./BottomPanel/PropertyTraceTable";
import { PersistentDetails } from "./Components/PersistentDetails";
import { Tooltip } from "./Components/Tooltip";
import { useCoupledExecution } from "./hooks/useCoupledExecution";
import { EditHistory, useEditHistory } from "./hooks/useEditHistory";
import { useParser } from "./hooks/useParser";
import { usePyodide } from "./hooks/usePyodide";
import { useSimulator } from "./hooks/useSimulator";
import { useTrial } from "./hooks/useTrial";
import { makeAllSetters, makePartialSetter } from "./makePartialSetter";
import { OpenFile } from "./Modals/OpenFile";
import { ModalOverlay } from "./Overlays/ModalOverlay";
import { prepareTraces } from "./SideBar/prepare_trace";
import { SideBar, SideBarState } from "./SideBar/SideBar";
import { TopPanel } from "./TopPanel/TopPanel";
import { DebugContext } from "./VisualEditor/context/DebugContext";
import { VisualEditor } from "./VisualEditor/VisualEditor";
import { useResizeable } from "@/hooks/useResizeable";
import { useDelay } from "./hooks/useDelay";
import { About } from "./Modals/About";
import { downloadObjectAsJson } from "@/util/download_json";
import { useMouse } from "./VisualEditor/hooks/useMouse";
import { initialEditorState } from "@/statecharts/concrete_syntax";
import { SavedTraces } from "./SideBar/Traces";

export function App() {
  // The entire persisted application state (minus the visual editor state)
  const [appState, setAppState] = useState<AppState>(defaultAppState);

  const setters = makeAllSetters(setAppState, Object.keys(appState) as (keyof AppState)[]);

  // The state of the visual editor (and all previous and future states)
  const [editHistory, setEditHistory] = useState<EditHistory|undefined>(undefined);

  // Wether a modal dialog is being shown or not
  const [modal, setModal] = useState<ReactElement|null>(null);

  // What the ???
  const trial = useTrial();

  const editorState = editHistory && editHistory.current;
  const {topology, abstractSyntax, syntaxErrors} = useParser(editorState);
  const historyCallbacks = useEditHistory(setEditHistory);

  // Show model name and last edit timestamp in document title (useful for bookmarking).
  useDelay(() => {
    const timeFormatted = formatDateTime(new Date());
    document.title = `${location.hostname === "localhost" ? "[dev] " : ""}${appState.topPanel.modelName} [StateBuddy] ${timeFormatted}`;
  }, 100, [appState, editorState]);

  // Store app state in URL hash:
  const modelSize = usePersistentAppState({
    appState, setAppState, editHistory, setEditHistory,
    delayMs: 100, // <-- only store URL hash if user doesn't do anything for 100 ms.
  });

  const coupledExecution = useCoupledExecution(abstractSyntax, appState.sideBar.plantsState);
  const simulator = useSimulator(coupledExecution);
  const {displayTime, refreshDisplayTime} = useDisplayTime(simulator.time);
  

  const currentRuntimeError = simulator.trace?.runtimeError;
  const runtimeErrors = currentRuntimeError
    && currentRuntimeError.highlight.map(uid => ({
        message: currentRuntimeError.message,
        shapeUid: uid,
      }))
    || [];
  const allErrors = [...syntaxErrors, ...runtimeErrors];
  const currentBigStep = simulator.currentTraceItem?.newState.sc.at(-1)?.newState.bigstep;
  const highlightActive = (currentBigStep && currentBigStep.mode) || new Set();
  const highlightTransitions = currentBigStep && currentBigStep.firedTransitions || [];

  const preparedTraces = useMemo(() => {
    return simulator.trace && abstractSyntax && prepareTraces(
      abstractSyntax,
      appState.sideBar.plantsState,
      simulator.trace.trace,
    ) || {};
  }, [simulator.trace, appState.sideBar.plantsState, abstractSyntax]);

  const [sideBarResizing, beginSideBarResize] = useResizeable(e =>
    setters.setSidePanelWidth(width => width - e.movementX));

  const pyodide = usePyodide();

  const hidePropertyTable = useCallback(() => setters.setSideBar(sb => ({...sb, showTable: false})), [setters.setSideBar]);
  const hideDebug = useCallback(() => setters.setTopPanel(tp => ({...tp, showDebug: false})), [setters.setTopPanel]);
  const hideFindReplace = useCallback(() => setters.setTopPanel(tp => ({...tp, showFindReplace: false})), [setters.setTopPanel]);

  const setSideBar = makePartialSetter(setAppState, "sideBar");
  const setProperties = makePartialSetter(setSideBar, "properties");
  const setTraces = makePartialSetter(setSideBar, "traces");
  const setSavedTraces = makePartialSetter(setTraces, "savedTraces");

  const onAboutStateBuddy = () => setModal(<About setModal={setModal} {...trial}/>);
  const onOpen = (modelName: string) => {
    editorState && setModal(<OpenFile
      onClose={() => setModal(null)}
      properties={appState.sideBar.properties}
      savedTraces={appState.sideBar.traces.savedTraces}
      setSavedTraces={setSavedTraces}
      editorState={editorState}
      bytes={modelSize.original}
      modelName={modelName}
      setProperties={setProperties}
      replaceModel={historyCallbacks.commitState}/>);
  };
  const onSave = (modelName: string) => {
    downloadObjectAsJson(
      {editorState, ...appState},
      modelName.replaceAll(' ','-')+'_'+formatDateTime(new Date()).replaceAll('/','-').replaceAll(':','-').replaceAll(' ','_')+".statebuddy.json");
  }

  const editorStuff = useMouse(appState.topPanel.mouseMap, appState.topPanel.zoom, editorState || initialEditorState, historyCallbacks);

  const debugSetters = makeAllSetters(setters.setDebug, Object.keys(appState.debug) as (keyof DebugState)[]);

  const setVisiblePlots = makePartialSetter(setters.setPlot, "visiblePlots");


  return <div className={styles.App} style={{cursor: sideBarResizing ? 'col-resize' : undefined}}>
    <ModalOverlay modal={modal} setModal={setModal}>
      {/* top-to-bottom: everything -> bottom panel */}
      <div className={styles.stackVertical} style={{height:'100%'}}>

        {/* left-to-right: main -> sidebar */}
        <div className={styles.stackHorizontal} style={{flexGrow:1, overflow: "auto"}}>

          {/* top-to-bottom: top bar, editor */}
          <div className={styles.stackVertical} style={{flexGrow:1, overflow: "hidden"}}>
            {/* Top bar */}
            <div
              className={styles.shadowBelow}
              style={{flex: '0 0 content'}}
            >
              {editHistory && editorState &&
                <TopPanel
                  topPanel={appState.topPanel}
                  setTopPanel={setters.setTopPanel}
                  editorState={editorState}
                  historyCallbacks={historyCallbacks}
                  startDragging={editorStuff.setDragging}
                  editHistory={editHistory}
                  simulator={simulator}

                  displayTime={displayTime}
                  refreshDisplayTime={refreshDisplayTime}

                  modelSize={modelSize}
                  trial={trial}
                  
                  onAboutStateBuddy={onAboutStateBuddy}
                  onOpen={onOpen}
                  onSave={onSave}
                />}
            </div>
            {/* Editor */}
            <div style={{flexGrow: 1, overflow: "auto"}}>
              {editorState && topology && syntaxErrors &&
                <DebugContext value={appState.debug}>
                  <VisualEditor
                    state={editorState}
                    // @ts-ignore
                    setState={historyCallbacks.commitState}
                    topology={topology}
                    editorStuff={editorStuff}
                    findText={appState.findReplace.findText}
                    zoom={appState.topPanel.zoom}
                    mouseMap={appState.topPanel.mouseMap}
                    highlightActive={highlightActive}
                    highlightTransitions={highlightTransitions}
                    syntaxErrors={syntaxErrors}
                    setModal={setModal}
                  />
                </DebugContext>}
            </div>
            
            {/* Stuff that shows below editor but next to sidebar */}
            <Greeter trial={trial}/>
            {appState.sideBar.showTable && appState.sideBar.properties.length > 0 && appState.sideBar.traces.savedTraces.length > 0 && coupledExecution && abstractSyntax &&
              <BelowEditor>
                <PropertyTraceTable
                  abstractSyntax={abstractSyntax}
                  properties={appState.sideBar.properties}
                  traces={appState.sideBar.traces.savedTraces}
                  onClose={hidePropertyTable}
                  checkProperty={pyodide.checkProperty}
                  cE={coupledExecution}
                  plantsState={appState.sideBar.plantsState}
                />
              </BelowEditor>}
            {editorState && appState.topPanel.showFindReplace &&
              <BelowEditor>
                <FindReplace
                  state={appState.findReplace}
                  setState={setters.setFindReplace}
                  cs={editorState}
                  setCS={historyCallbacks.commitState}
                  hide={hideFindReplace}/>
              </BelowEditor>
            }
            {appState.topPanel.showDebug &&
              <BelowEditor>
                <DebugPanel
                  {...appState.debug}
                  {...debugSetters}
                  onHide={hideDebug}
                />
              </BelowEditor>}

          </div>

          {/* handle for resizing */}
          <div style={{
            flex: '0 0 content',
          }}>
            <div
              style={{
                height: '100%',
                backgroundColor: sideBarResizing ? 'var(--tooltip-bg-color)' : 'var(--separator-color)',
                width: 2,
                cursor: 'col-resize',
              }}
              onMouseDown={beginSideBarResize}
            />
          </div>

          {/* Right: sidebar */}
          <div style={{
            flex: '0 0 content',
            overflowY: "auto",
            overflowX: "auto",
            flexBasis: appState.sidePanelWidth,
            maxWidth: '75vw',
            minWidth: 20,

            // maxWidth: `max(min(${appState.sidePanelWidth}px, 75vw), 100px)`,
          }}>
            <div className={styles.stackVertical} style={{height:'100%'}}>
              <SideBar
                abstractSyntax={abstractSyntax}
                state={appState.sideBar}
                setState={setters.setSideBar}
                coupledState={simulator.currentTraceItem?.newState}
                simulator={simulator}
                preparedTraces={preparedTraces}
                checkProperty={pyodide.checkProperty}
              />
            </div>
          </div>
        </div>

        {/* Bottom panel */}
        <div style={{flex: '0 0 content', borderTop: '1px solid var(--separator-color'}}>
          <div className={styles.statusBar}>
            <PersistentDetails state={appState.showPlot} setState={setters.setShowPlot}>
              <summary>
                plot
                <Tooltip tooltip="All signals are boolean. Input/ouput event parameters start with `in_`/`out_` resp. Plant state starts with `<plantname>_`" above align="left">
                  <HelpOutlineIcon fontSize='small'/>
                </Tooltip>
              </summary>
              {preparedTraces && simulator.trace &&
                <Plot width="100%"
                  prepped={preparedTraces}
                  trace={simulator.trace}
                  visiblePlots={appState.plot.visiblePlots}
                  setVisiblePlots={setVisiblePlots}
                />}
            </PersistentDetails>
          </div>
          {syntaxErrors && abstractSyntax &&
            <BottomPanel
              abstractSyntax={abstractSyntax}
              state={appState.bottomPanel}
              setState={setters.setBottomPanel}
              errors={syntaxErrors}
              pyodideStatus={pyodide.status}
            />
          }
        </div>
      </div>
    </ModalOverlay>
  </div>;
}

function BelowEditor({children}: PropsWithChildren<{}>) {
  return <div style={{borderTop: '1px var(--separator-color) solid'}}>{children}</div>;
}

export default App;
