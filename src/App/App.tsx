import styles from "./App.module.css";

import { PropsWithChildren, ReactElement, useCallback, useMemo, useState } from "react";

import { useDisplayTime } from "@/hooks/useDisplayTime";
import { initialEditorState } from "@/statecharts/concrete_syntax";
import { downloadObjectAsJson } from "@/util/download_json";
import { formatDateTime } from "@/util/util";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { AppState, defaultAppState } from "./App.state";
import { BottomPanel } from "./BottomPanel/BottomPanel";
import { DebugPanel } from "./BottomPanel/Debug";
import { DebugState } from './migrations/v1_types';
import { FindReplace } from "./BottomPanel/FindReplace";
import { Greeter } from "./BottomPanel/Greeter";
import { Plot } from "./BottomPanel/Plot";
import { PropertyTraceTable } from "./BottomPanel/PropertyTraceTable";
import { PersistentDetails } from "./Components/PersistentDetails";
import { Tooltip } from "./Components/Tooltip";
import { useCoupledExecution } from "./hooks/useCoupledExecution";
import { useDelay } from "./hooks/useDelay";
import { EditHistory, useEditHistory } from "./hooks/useEditHistory";
import { useParser } from "./hooks/useParser";
import { usePersistentAppState } from "./hooks/usePersistentAppState";
import { usePyodide } from "./hooks/usePyodide";
import { useSimulator } from "./hooks/useSimulator";
import { useTrial } from "./hooks/useTrial";
import { makeAllSetters, makePartialSetter } from "./makePartialSetter";
import { About } from "./Modals/About";
import { OpenFile } from "./Modals/OpenFile";
import { ModalOverlay } from "./Overlays/ModalOverlay";
import { prepareTraces } from "./SideBar/prepare_trace";
import { TopPanel } from "./TopPanel/TopPanel";
import { DebugContext } from "./VisualEditor/context/DebugContext";
import { useMouse } from "./VisualEditor/hooks/useMouse";
import { VisualEditor } from "./VisualEditor/VisualEditor";
import { usePropertyCheck } from "./hooks/usePropertyCheck";
import { Panel } from "./Panel/Panel";
import { GlobalProps } from "./Panel/PanelItem";
import { ResizeHandle } from "./Panel/ResizeHandle";
import { SizedPanel } from "./Panel/SizedPanel";
import { WithShadow } from "./Components/WithShadow";
import { defaultPropertyEditorState } from "./migrations/v1_default";

export function App() {
  // The entire persisted application state (minus the visual editor state)
  const [appState, setAppState] = useState<AppState>(defaultAppState);

  // @ts-ignore: useful for debugging
  window['appState'] = appState;
  // @ts-ignore: useful for debugging
  window['setAppState'] = setAppState;

  const setters = makeAllSetters(setAppState, Object.keys(appState) as (keyof AppState)[]);

  // The state of the visual editor (and all previous and future states)
  const [editHistory, setEditHistory] = useState<EditHistory|undefined>(undefined);

  // Wether a modal dialog is being shown or not
  const [modal, setModal] = useState<ReactElement|null>(null);

  // What the ???
  const trial = useTrial();

  const editorState = editHistory && editHistory.current;
  const {topology, abstractSyntax, syntaxErrors} = useParser(editorState, appState.declaredInputs, appState.declaredOutputs);
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
  
  const allErrors = useMemo(
    () => [...syntaxErrors, ...simulator.runtimeErrors],
    [syntaxErrors, simulator.runtimeErrors]);

  const preparedTraces = useMemo(() => {
    return simulator.trace && abstractSyntax && prepareTraces(
      abstractSyntax,
      appState.sideBar.plantsState,
      simulator.trace.trace,
    ) || {};
  }, [simulator.trace, appState.sideBar.plantsState, abstractSyntax]);

  const pyodide = usePyodide();

  const propertyResults = usePropertyCheck(
    preparedTraces,
    appState.sideBar.propertyEditor.properties,
    pyodide.checkProperty);

  const tracesAndResults = {
    ...preparedTraces,
    ...Object.fromEntries((propertyResults||[]).flatMap(([result], i) => {
      // non-error property check results are included in the traces that can be plotted:
      return result && [["P"+i, result]] || [];
    }))
  }

  appState.sideBar.propertyEditor.showTable


  const setSideBar = setters.setSideBar;
  const {setPlantsState, setPropertyEditor, setTraces, setMqtt} = makeAllSetters(
    setSideBar,
    // @ts-ignore
    Object.keys(appState.sideBar));
    // @ts-ignore
  const propEditSetters = makeAllSetters(setPropertyEditor, Object.keys(defaultPropertyEditorState));
  const setShowTable = propEditSetters.setShowTable;
  const setProperties = propEditSetters.setProperties;
  const setSavedTraces = makePartialSetter(setTraces, "savedTraces");

  const hidePropertyTable = useCallback(() => setShowTable(false), [setShowTable]);
  const hideDebug = useCallback(() => setters.setTopPanel(tp => ({...tp, showDebug: false})), [setters.setTopPanel]);
  const hideFindReplace = useCallback(() => setters.setTopPanel(tp => ({...tp, showFindReplace: false})), [setters.setTopPanel]);
  const hideModal = useCallback(() => setModal(null), [setModal]);

  const onAboutStateBuddy = useCallback(() => setModal(<About setModal={setModal} {...trial}/>), [trial]);
  const onOpen = useCallback((modelName: string) => {
    editorState && setModal(<OpenFile
      onClose={hideModal}
      properties={appState.sideBar.propertyEditor.properties}
      savedTraces={appState.sideBar.traces.savedTraces}
      setSavedTraces={setSavedTraces}
      editorState={editorState}
      bytes={modelSize.original}
      modelName={modelName}
      setProperties={setProperties}
      replaceModel={historyCallbacks.commitState}/>);
  }, [appState.sideBar, editorState, modelSize, historyCallbacks]);
  const onSave = useCallback((modelName: string) => {
    downloadObjectAsJson(
      {editorState, ...appState},
      modelName.replaceAll(' ','-')+'_'+formatDateTime(new Date()).replaceAll('/','-').replaceAll(':','-').replaceAll(' ','_')+".statebuddy.json");
  }, [editorState, appState]);

  const editorStuff = useMouse(appState.topPanel.mouseMap, appState.topPanel.zoom, editorState || initialEditorState, historyCallbacks);

  const debugSetters = makeAllSetters(setters.setDebug, Object.keys(appState.debug) as (keyof DebugState)[]);

  
  const globalProps: GlobalProps = useMemo(() => ({
    abstractSyntax,
    simulator,
    propertyResults,
    mqtt: appState.sideBar.mqtt,
    plantsState: appState.sideBar.plantsState,
    propertyEditor: appState.sideBar.propertyEditor,
    traces: appState.sideBar.traces,
    setMqtt,
    setPlantsState,
    setPropertyEditor,
    setTraces,
    declaredInputs: appState.declaredInputs,
    setDeclaredInputs: setters.setDeclaredInputs,
    declaredOutputs: appState.declaredOutputs,
    setDeclaredOutputs: setters.setDeclaredOutputs,
  }), [appState, abstractSyntax, simulator, propertyResults]);

  return <div className={styles.App} style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
    <ModalOverlay modal={modal} setModal={setModal}>

      {/* Top bar */}
      <WithShadow>
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
      </WithShadow>

      {/* Between top bar and bottom bar(s), we have, from left to right: panel, editor, panel */}
      <div className={styles.stackHorizontal} style={{flexGrow: 1, overflow: 'clip auto'}}>

        {/* Left panel */}
        <SizedPanel width={appState.leftPanelWidth}>
          <Panel
            state={appState.leftPanel}
            setState={setters.setLeftPanel}
            globalProps={globalProps}
          />
        </SizedPanel>
        <ResizeHandle
          getDelta={e => e.movementX}
          setSize={setters.setLeftPanelWidth}/>

        {/* top-to-bottom: editor, find & replace, ... */}
        <div style={{display: 'flex', flexDirection: 'column', flexGrow: 1,
          overflow: 'auto', // <-- this element will overflow in the X-direction (because its parent is a ROW)
        }}>

          {/* Editor */}
          <div style={{overflow: 'auto'}}> {/* <-- this element will overflow in the Y-direction (because its parent is a COLUMN) */}
            {editorState && topology && syntaxErrors &&
              <DebugContext value={appState.debug}>
                <VisualEditor
                  state={editorState}
                  // @ts-ignore
                  setState={historyCallbacks.commitState}
                  topology={topology}
                  editorStuff={editorStuff}
                  findText={appState.topPanel.showFindReplace && appState.findReplace.findText || ""}
                  zoom={appState.topPanel.zoom}
                  mouseMap={appState.topPanel.mouseMap}
                  highlightActive={simulator.highlightActive}
                  highlightTransitions={simulator.highlightTransitions}
                  syntaxErrors={allErrors}
                  setModal={setModal}
                />
              </DebugContext>}
          </div>
          
          <Greeter trial={trial}/>
          {appState.sideBar.propertyEditor.showTable && appState.sideBar.propertyEditor.properties.length > 0 && appState.sideBar.traces.savedTraces.length > 0 && coupledExecution && abstractSyntax &&
            <BelowEditor>
              <PropertyTraceTable
                abstractSyntax={abstractSyntax}
                properties={appState.sideBar.propertyEditor.properties}
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

        {/* Right panel */}
        <ResizeHandle
          getDelta={e => -e.movementX}
          setSize={setters.setRightPanelWidth}
        />
        <SizedPanel width={appState.rightPanelWidth}>
          <Panel
            state={appState.rightPanel}
            setState={setters.setRightPanel}
            globalProps={globalProps}
          />
        </SizedPanel>
      </div>

      {/* Bottom bars */}
      <div style={{flex: '0 0 content', borderTop: '1px solid var(--separator-color'}}>
        <div className={styles.statusBar}>
          <PersistentDetails state={appState.showPlot} setState={setters.setShowPlot}>
            <summary>
              plot
              <Tooltip tooltip="All signals are boolean. Input/ouput event parameters start with `in_`/`out_` resp. Plant state starts with `<plantname>_`" above align="left">
                <HelpOutlineIcon fontSize='small'/>
              </Tooltip>
            </summary>
            {preparedTraces && simulator.trace && appState.showPlot &&
              <Plot width="100%"
                prepped={tracesAndResults}
                trace={simulator.trace}
                state={appState.plot}
                setState={setters.setPlot}
                displayTime={displayTime}
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
    </ModalOverlay>
  </div>;
}

function BelowEditor({children}: PropsWithChildren<{}>) {
  return <div style={{borderTop: '1px var(--separator-color) solid'}}>{children}</div>;
}

export default App;
