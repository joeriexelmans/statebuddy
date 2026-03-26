import gitRev from "@/git-rev.txt";
import { useShortcuts } from "@/hooks/useShortcuts";
import { Vec2D } from '@/util/geometry';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { memo } from "react";
import { useToggle } from "../../hooks/useToggle";
import { UndoCallbacks } from "../../hooks/useUndo";
import { ModelSize } from "../../hooks/useUrlHashState";
import { prettyNumber } from '../../util/pretty';
import styles from "../App.module.css";
import { AppState } from "../App.state";
import { Tooltip } from "../Components/Tooltip";
import { TwoStateButton } from "../Components/TwoStateButton";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";
import { SimulatorStuff } from '../hooks/useSimulator';
import { Trial } from '../hooks/useTrial';
import { useUpdater } from '../hooks/useUpdater';
import { DeepSetter } from "../makePartialSetter";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { Toolbar } from './Toolbar';
import { EditorToolbar } from "./Toolbars/Editor/EditorToolbar";
import { ExecutionToolbar } from "./Toolbars/Execution/ExecutionToolbar";
import { ModeToolbar } from "./Toolbars/Mode/ModeToolbar";

export type TopPanelProps = {
  appState: AppState,
  setAppState: DeepSetter<AppState>,

  historyCallbacks: UndoCallbacks<VisualEditorState>,

  // editing
  startDragging: (where: Vec2D) => void,

  // execution
  simulator: SimulatorStuff,

  // not necessarily equal to the simulated time of the most recent execution step, because with realtime simulation, the time *appears* to evolve continuously (which is just a special effect btw)
  displayTime: number,
  refreshDisplayTime: () => void,

  // saving / downloading
  modelSize: ModelSize,

  trial: Trial,

  onAboutStateBuddy: () => void,
  // onOpen: (modelName: string) => void,
  onSave: (modelName: string) => void,
};

const ShortcutShowKeys = <kbd>~</kbd>;
const ShortcutExport = <><kbd>Ctrl</kbd>+<kbd>S</kbd></>;

const toolbarGap = {columnGap: '1em'};

export const TopPanel = memo(function TopPanel(props: TopPanelProps) {
  const {trial, displayTime, refreshDisplayTime, modelSize, startDragging, simulator, appState, setAppState, onAboutStateBuddy, onSave, historyCallbacks,
  } = props;
  const {setKeys, setFind} = setAppState.setView.setVisibility;
  const showKeys = appState.view.visibility.keys;
  const toggleKeys = useToggle(setKeys);
  const {currentTraceItem, simulatorCallbacks} = simulator;

  const updateAvailable = useUpdater();

  const modelName = appState.view.topPanel.modelName;

  useShortcuts([
    {keys: ["`"], action: toggleKeys},
    {keys: ["Shift", "~"], action: toggleKeys},
    // {keys: ["Ctrl", "o"], action: () => onOpen(modelName)},
    {keys: ["Ctrl", "s"], action: () => onSave(modelName)},
    {keys: ["Ctrl", "Shift", "F"], action: useToggle(setFind)},
    {keys: ["i"], action: simulatorCallbacks.onInit},
    {keys: ["c"], action: simulatorCallbacks.onClear},
    {keys: ["Backspace"], action: simulatorCallbacks.onBack},
    {keys: ["Tab"], action: currentTraceItem && simulatorCallbacks.onSkip || simulatorCallbacks.onInit},
    {keys: ["Shift", "Tab"], action: simulatorCallbacks.onBack},
  ]);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  return <Toolbar style={toolbarGap}>
    {/* shortcuts / about */}
    <Toolbar>
      <Tooltip tooltip={updateAvailable ? `${trial.appName} update available!
Refresh the page to get the latest version.` : `about ${trial.appName}`} align="left" showWhen={updateAvailable ? "always" : "hover"}>
        <button onClick={onAboutStateBuddy}
          style={{verticalAlign: 'bottom'}}>
          <InfoOutlineIcon fontSize='small'/>
        </button>
      </Tooltip>
      <Tooltip tooltip="open cheat sheet" align='left'>
        <button onClick={() => {
          window.open(`https://deemz.org/git/research/statebuddy/src/commit/${gitRev}/docs/cheat_sheet.md`, '_blank');
        }}>
          <HelpOutlineIcon fontSize='small'/>
        </button>
      </Tooltip>
      <KeyInfo keyInfo={ShortcutShowKeys}>
        <Tooltip tooltip="show/hide keyboard shortcuts" align="left">
        <TwoStateButton active={showKeys} onClick={toggleKeys}><KeyboardIcon fontSize="small"/></TwoStateButton>
        </Tooltip>
      </KeyInfo>
    </Toolbar>

    <Toolbar>
      {/* <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>O</kbd></>}>
        <Tooltip tooltip='import file(s)...'>
          <button onClick={() => onOpen(modelName)}>
            <UploadFileIcon fontSize='small'/>
          </button>
        </Tooltip>
      </KeyInfo> */}
      <Tooltip tooltip={`model size (compressed):\n${prettyNumber(modelSize.compressed)} bytes`} align='left'>
        <input
          type="text"
          placeholder='model name'
          value={modelName}
          style={{width:Math.max(modelName.length*6.5, 100)}}
          onChange={e => setAppState.setView.setTopPanel.setModelName(e.target.value)}
          className={styles.description}
          />
      </Tooltip>
      <KeyInfo keyInfo={ShortcutExport}>
        <Tooltip tooltip='export as JSON'>
          <button onClick={() => onSave(modelName)}>
            <SaveAltIcon fontSize='small'/>
          </button>
        </Tooltip>
      </KeyInfo>
    </Toolbar>

    <EditorToolbar
      KeyInfo={KeyInfo}
      syntax={appState.syntax}
      historyCallbacks={historyCallbacks}
      startDragging={startDragging}
    />

    <ModeToolbar
      KeyInfo={KeyInfo}
      view={appState.view}
      setView={setAppState.setView}
    />

    {/* execution */}
    <ExecutionToolbar
      simulator={simulator}
      showKeys={showKeys}
      displayTime={displayTime}
      refreshDisplayTime={refreshDisplayTime}
    />
  </Toolbar>;
});
