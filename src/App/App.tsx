import styles from "./App.module.css";

import { Dispatch, PropsWithChildren, ReactElement, SetStateAction, useCallback, useMemo, useState } from "react";

import { useDisplayTime } from "@/hooks/useDisplayTime";
import { useLocalStorage } from "@/hooks/usePersistentState";
import { useMtlWorkerPool } from "@/mtl-checker/useWorkerPool";
import { initialEditorState } from "@/statecharts/concrete_syntax";
import { downloadObjectAsJson } from "@/util/download_json";
import { formatDateTime } from "@/util/util";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { AppState, defaultAppState } from "./App.state";
import { BottomPanel } from "./BottomPanel/BottomPanel";
import { DebugPanel } from "./BottomPanel/Debug";
import { FindReplace } from "./BottomPanel/FindReplace";
import { Greeter } from "./BottomPanel/Greeter";
import { Plot } from "./BottomPanel/Plot";
import { PropertyTable } from "./BottomPanel/PropertyTable";
import { PersistentDetails } from "./Components/PersistentDetails";
import { Tooltip } from "./Components/Tooltip";
import { WithShadow } from "./Components/WithShadow";
import { useCoupledExecution } from "./hooks/useCoupledExecution";
import { useDelayedEffect } from "./hooks/useDelay";
import { EditHistory, useEditHistory } from "./hooks/useEditHistory";
import { useParser } from "./hooks/useParser";
import { usePersistentAppState } from "./hooks/usePersistentAppState";
import { usePropertyCheck } from "./hooks/usePropertyCheck";
import { useSimulator } from "./hooks/useSimulator";
import { useTrial } from "./hooks/useTrial";
import { makeDeepSetter } from "./makePartialSetter";
import { PanelState } from "./migrations/v1_types";
import { About } from "./Modals/About";
import { ModalOverlay } from "./Overlays/ModalOverlay";
import { Panel } from "./Panel/Panel";
import { GlobalProps } from "./Panel/PanelItem";
import { ResizeHandle } from "./Panel/ResizeHandle";
import { SizedPanel } from "./Panel/SizedPanel";
import { prepareTraces } from "./SideBar/prepare_trace";
import { TopPanel } from "./TopPanel/TopPanel";
import { DebugContext } from "./VisualEditor/context/DebugContext";
import { useMouse } from "./VisualEditor/hooks/useMouse";
import { VisualEditor } from "./VisualEditor/VisualEditor";

export function App() {
  // The entire persisted application state (minus the visual editor state)
  const [appState, setAppStateShallow] = useState<AppState>(defaultAppState);
  const setAppState = useMemo(() => makeDeepSetter(defaultAppState, setAppStateShallow), [setAppStateShallow]);

  // @ts-ignore: useful for debugging
  window['appState'] = appState;

  // The state of the visual editor (and all previous and future states)
  const [editHistory, setEditHistory] = useState<EditHistory|undefined>(undefined);

  // Wether a modal dialog is being shown or not
  const [modal, setModal] = useState<ReactElement|null>(null);

  // Persist the size of the worker pool in the user's localStorage (not in AppState) - the optimal value here is machine-bound.
  const [nWorkers, setNWorkers] = useLocalStorage("nWorkers", 4);

  // What the ???
  const trial = useTrial();

  const editorState = editHistory && editHistory.current;
  const {topology, abstractSyntax, syntaxErrors} = useParser(editorState, appState.syntax.declaredInputs, appState.syntax.declaredOutputs);
  const historyCallbacks = useEditHistory(setEditHistory);

  // Show model name and last edit timestamp in document title (useful for bookmarking).
  useDelayedEffect(() => {
    const timeFormatted = formatDateTime(new Date());
    document.title = `${location.hostname === "localhost" ? "[dev] " : ""}${appState.view.topPanel.modelName} [StateBuddy] ${timeFormatted}`;
  }, 100, [appState, editorState]);

  // Store app state in URL hash:
  const modelSize = usePersistentAppState({
    appState, setAppState: setAppStateShallow, editHistory, setEditHistory,
    delayMs: 100, // <-- only store URL hash if user doesn't do anything for 100 ms.
  });

  const coupledExecution = useCoupledExecution(abstractSyntax, appState.execution.plants);
  const simulator = useSimulator(coupledExecution);
  const {displayTime, refreshDisplayTime} = useDisplayTime(simulator.time);
  
  const allErrors = useMemo(
    () => [...syntaxErrors, ...simulator.runtimeErrors],
    [syntaxErrors, simulator.runtimeErrors]);

  // Performance optimization: only compute what we truly need:
  const panelHasVisibleProperties = (panel: PanelState) => panel.items.find(item => item.type === "properties")?.expanded
  const propertiesVisible = panelHasVisibleProperties(appState.view.leftPanel)
                         || panelHasVisibleProperties(appState.view.rightPanel);
  const shouldPrepareTraces = appState.view.visibility.plot || propertiesVisible;

  // Convert from internal trace format to a format that py-mtl understands.
  // Also, we use this format for plotting our plot.
  const preparedTraces = useMemo(() => {
    if (simulator.trace && abstractSyntax && shouldPrepareTraces) {
      return prepareTraces(
        abstractSyntax,
        appState.execution.plants,
        simulator.trace.trace,
      );
    }
  }, [simulator.trace && simulator.trace.trace, appState.execution.plants, abstractSyntax, shouldPrepareTraces]);

  const [checkProperty, workerPoolState] = useMtlWorkerPool(nWorkers);

  // Check ALL properties on the current execution trace.
  // We display the results in 3 places:
  //  - the plot
  //  - the property editor
  //  - the execution trace
  const propertyResults = usePropertyCheck(
    preparedTraces,
    appState.execution.properties,
    checkProperty);

  const tracesAndResults = {
    ...(preparedTraces || {}),
    ...Object.fromEntries((propertyResults||[]).flatMap((result, i) => {
      // non-error property check results are included in the traces that can be plotted:
      if (result.kind === "ok") {
        return [["P"+i, result.result]];
      }
      if (result.kind === "pending") {
        return [["P"+i, [[0, false] as [number, boolean]]]];
      }
      return [];
    })),
  }

  const onAboutStateBuddy = useCallback(() => setModal(<About setModal={setModal} {...trial}/>), [trial]);
  // const onOpen = useCallback((modelName: string) => {
  //   editorState && setModal(<OpenFile
  //     onClose={hideModal}
  //     properties={appState.sideBar.propertyEditor.properties}
  //     savedTraces={appState.sideBar.traces.savedTraces}
  //     setSavedTraces={setSavedTraces}
  //     editorState={editorState}
  //     bytes={modelSize.original}
  //     modelName={modelName}
  //     setProperties={setProperties}
  //     replaceModel={historyCallbacks.commitState}/>);
  // }, [appState.sideBar, editorState, modelSize, historyCallbacks]);
  const onSave = useCallback((modelName: string) => {
    downloadObjectAsJson(
      {editorState, ...appState},
      modelName.replaceAll(' ','-')+'_'+formatDateTime(new Date()).replaceAll('/','-').replaceAll(':','-').replaceAll(' ','_')+".statebuddy.json");
  }, [editorState, appState]);

  const editorStuff = useMouse(appState.view.topPanel.mouseMap, appState.view.topPanel.zoom, editorState || initialEditorState, historyCallbacks);

  const globalProps: GlobalProps = useMemo(() => ({
    appState,
    setAppState,
    simulator,
    abstractSyntax,
    propertyResults,
  }), [appState, simulator, abstractSyntax, propertyResults]);

  const hidePropertyTable = hide(setAppState.setView.setVisibility.setTable);
  const hideFindReplace = hide(setAppState.setView.setVisibility.setFind);
  const hideDebug = hide(setAppState.setView.setVisibility.setDebug);

  return <div className={styles.App} style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
    <ModalOverlay modal={modal} setModal={setModal}>

      {/* Top bar */}
      <WithShadow>
        {editHistory && editorState &&
          <TopPanel
            appState={appState}
            setAppState={setAppState}
            historyCallbacks={historyCallbacks}
            startDragging={editorStuff.setDragging}
            editHistory={editHistory}
            simulator={simulator}
            displayTime={displayTime}
            refreshDisplayTime={refreshDisplayTime}
            modelSize={modelSize}
            trial={trial}
            onAboutStateBuddy={onAboutStateBuddy}
            // onOpen={() => {}}
            onSave={onSave}
          />}
      </WithShadow>

      {/* Between top bar and bottom bar(s), we have, from left to right: panel, editor, panel */}
      <div className={styles.stackHorizontal} style={{flexGrow: 1, overflow: 'clip auto'}}>

        {/* Left panel */}
        <SizedPanel width={appState.view.leftPanel.width}>
          <Panel
            items={appState.view.leftPanel.items}
            setItems={setAppState.setView.setLeftPanel.setItems}
            globalProps={globalProps}
          />
        </SizedPanel>
        <ResizeHandle
          getDelta={e => e.movementX}
          setSize={setAppState.setView.setLeftPanel.setWidth}/>

        {/* top-to-bottom: editor, find & replace, ... */}
        <div style={{display: 'flex', flexDirection: 'column', flexGrow: 1,
          overflow: 'auto', // <-- this element will overflow in the X-direction (because its parent is a ROW)
        }}>

          {/* Editor */}
          <div style={{overflow: 'auto'}}> {/* <-- this element will overflow in the Y-direction (because its parent is a COLUMN) */}
            {editorState && topology && syntaxErrors &&
              <DebugContext value={appState.view.debug}>
                <VisualEditor
                  state={editorState}
                  // @ts-ignore
                  setState={historyCallbacks.commitState}
                  topology={topology}
                  editorStuff={editorStuff}
                  findText={appState.view.visibility.find && appState.find.findText || ""}
                  zoom={appState.view.topPanel.zoom}
                  mouseMap={appState.view.topPanel.mouseMap}
                  highlightActive={simulator.highlightActive}
                  highlightTransitions={simulator.highlightTransitions}
                  syntaxErrors={allErrors}
                  setModal={setModal}
                />
              </DebugContext>}
          </div>
          
          <Greeter trial={trial}/>
          {appState.view.visibility.table && appState.execution.properties.length > 0 && appState.execution.savedTraces.length > 0 && coupledExecution && abstractSyntax &&
            <BelowEditor>
              <PropertyTable
                abstractSyntax={abstractSyntax}
                execution={appState.execution}
                cE={coupledExecution}
                onClose={hidePropertyTable}
                checkProperty={checkProperty}
              />
            </BelowEditor>}
          {editorState && appState.view.visibility.find &&
            <BelowEditor>
              <FindReplace
                state={appState.find}
                setState={setAppState.setFind._setShallow}
                cs={editorState}
                setCS={historyCallbacks.commitState}
                hide={hideFindReplace}/>
            </BelowEditor>
          }
          {appState.view.visibility.debug &&
            <BelowEditor>
              <DebugPanel
                state={appState.view.debug}
                setState={setAppState.setView.setDebug}
                onHide={hideDebug}
              />
            </BelowEditor>}
        </div>

        {/* Right panel */}
        <ResizeHandle
          getDelta={e => -e.movementX}
          setSize={setAppState.setView.setRightPanel.setWidth}
        />
        <SizedPanel width={appState.view.rightPanel.width}>
          <Panel
            items={appState.view.rightPanel.items}
            setItems={setAppState.setView.setRightPanel.setItems}
            globalProps={globalProps}
          />
        </SizedPanel>
      </div>

      {/* Bottom bars */}
      <div style={{flex: '0 0 content', borderTop: '1px solid var(--separator-color'}}>
        <div className={styles.statusBar}>
          <PersistentDetails state={appState.view.visibility.plot} setState={setAppState.setView.setVisibility.setPlot}>
            <summary>
              plot
              <Tooltip tooltip="All signals are boolean. Input/ouput event parameters start with `in_`/`out_` resp. Plant state starts with `<plantname>_`" above align="left">
                <HelpOutlineIcon fontSize='small'/>
              </Tooltip>
            </summary>
            {preparedTraces && simulator.trace && appState.view.visibility.plot &&
              <Plot width="100%"
                prepped={tracesAndResults}
                trace={simulator.trace}
                visible={appState.view.plot.visible}
                setVisible={setAppState.setView.setPlot.setVisible._setShallow}
                displayTime={displayTime}
              />}
          </PersistentDetails>
        </div>
        {syntaxErrors && abstractSyntax &&
          <BottomPanel
            abstractSyntax={abstractSyntax}
            errorsExpanded={appState.view.visibility.errors}
            setErrorsExpanded={setAppState.setView.setVisibility.setErrors}
            errors={syntaxErrors}
            // pyodideStatus={pyodide.status}
            workerPoolState={workerPoolState}
            setNWorkers={setNWorkers}
          />
        }
      </div>
    </ModalOverlay>
  </div>;
}

const hide = (setter: Dispatch<SetStateAction<boolean>>) => {
  return useCallback(() => setter(false), [setter]);
}

function BelowEditor({children}: PropsWithChildren<{}>) {
  return <div style={{borderTop: '1px var(--separator-color) solid'}}>{children}</div>;
}

export default App;
