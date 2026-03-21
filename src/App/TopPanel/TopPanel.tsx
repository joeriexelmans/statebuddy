import gitRev from "@/git-rev.txt";
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { useShortcuts } from "@/hooks/useShortcuts";
import BugReportIcon from '@mui/icons-material/BugReport';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { Vec2D } from '@/util/geometry';
import { Dispatch, memo, useCallback } from "react";
import { prettyNumber } from '../../util/pretty';
import styles from "../App.module.css";
import { Tooltip } from "../Components/Tooltip";
import { TwoStateButton } from "../Components/TwoStateButton";
import { SavedTraces } from '../migrations/v2_types';
import { copySelection, pasteData } from '../VisualEditor/hooks/useCopyPaste';
import { rotateSelection } from '../VisualEditor/transformations/rotate';
import { EditHistory, EditHistoryCallbacks } from '../hooks/useEditHistory';
import { ModelSize } from '../hooks/usePersistentAppState';
import { SimulatorStuff } from '../hooks/useSimulator';
import { Trial } from '../hooks/useTrial';
import { useUpdater } from '../hooks/useUpdater';
import { makeAllSetters, WithSetters } from "../makePartialSetter";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { Toolbar } from './Toolbar';
import { Execution } from './Toolbars/Execution';
import { RotateButtons } from "./Toolbars/RotateButtons";
import { ToolSelect } from "./Toolbars/ToolSelect";
import { UndoRedoButtons } from "./Toolbars/UndoRedoButtons";
import { ZoomButtons } from "./Toolbars/ZoomButtons";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";
import { TopPanelState } from "../migrations/v2_types";

export type TopPanelProps = WithSetters<{
  topPanel: TopPanelState,
}> & {
  editorState: VisualEditorState,

  historyCallbacks: EditHistoryCallbacks,

  // editing
  startDragging: (where: Vec2D) => void,
  editHistory: EditHistory,

  // execution
  simulator: SimulatorStuff,

  // not necessarily equal to the simulated time of the most recent execution step, because with realtime simulation, the time *appears* to evolve continuously (which is just a special effect btw)
  displayTime: number,
  refreshDisplayTime: () => void,

  // saving / downloading
  modelSize: ModelSize,

  trial: Trial,

  onAboutStateBuddy: () => void,
  onOpen: (modelName: string) => void,
  onSave: (modelName: string) => void,
};

const ShortCutShowKeys = <kbd>~</kbd>;

function toggle(booleanSetter: Dispatch<(state: boolean) => boolean>) {
  return () => booleanSetter(x => !x);
}

export const TopPanel = memo(function TopPanel(props: TopPanelProps) {
  const {trial, editHistory, displayTime, refreshDisplayTime, modelSize, editorState, startDragging, simulator, topPanel, setTopPanel,
    onAboutStateBuddy, onOpen, onSave, historyCallbacks,
  } = props;

  const {modelName, showDebug, showFindReplace, showKeys, zoom} = topPanel;
  const {setModelName, setShowDebug, setShowFindReplace, setShowKeys, setZoom, setMouseMap} = makeAllSetters(setTopPanel, Object.keys(topPanel) as (keyof TopPanelState)[]);

  const {currentTraceItem, simulatorCallbacks} = simulator;

  const updateAvailable = useUpdater();

  useShortcuts([
    {keys: ["`"], action: toggle(setShowKeys)},
    {keys: ["Shift", "~"], action: toggle(setShowKeys)},
    {keys: ["Ctrl", "o"], action: () => onOpen(modelName)},
    {keys: ["Ctrl", "s"], action: () => onSave(modelName)},
    {keys: ["Ctrl", "Shift", "F"], action: toggle(setShowFindReplace)},
    {keys: ["i"], action: simulatorCallbacks.onInit},
    {keys: ["c"], action: simulatorCallbacks.onClear},
    {keys: ["Backspace"], action: simulatorCallbacks.onBack},
  ]);

  useShortcuts([
    {keys: ["Tab"], action: currentTraceItem && simulatorCallbacks.onSkip || simulatorCallbacks.onInit},
    {keys: ["Shift", "Tab"], action: simulatorCallbacks.onBack},
  ]);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  return <Toolbar style={{columnGap: '1em'}}>
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
      <KeyInfo keyInfo={ShortCutShowKeys}>
        <Tooltip tooltip="show/hide keyboard shortcuts" align="left">
        <TwoStateButton active={showKeys} onClick={useCallback(() => setShowKeys(s => !s), [setShowKeys])}><KeyboardIcon fontSize="small"/></TwoStateButton>
        </Tooltip>
      </KeyInfo>
    </Toolbar>

    <Toolbar>
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>O</kbd></>}>
        <Tooltip tooltip='import file(s)...'>
          <button onClick={() => onOpen(modelName)}>
            <UploadFileIcon fontSize='small'/>
          </button>
        </Tooltip>
      </KeyInfo>
      <Tooltip tooltip={`model size: ${prettyNumber(modelSize.original)} bytes
compressed: ${prettyNumber(modelSize.compressed)} bytes (${Math.round(modelSize.compressed/modelSize.original*100)}%)`} align='left'>
        <input
          type="text"
          placeholder='model name'
          value={modelName}
          style={{width:Math.max(modelName.length*6.5, 100)}}
          onChange={e => setModelName(e.target.value)}
          className={styles.description}
          />
      </Tooltip>
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>S</kbd></>}>
        <Tooltip tooltip='export as JSON'>
          <button onClick={() => onSave(modelName)}>
            <SaveAltIcon fontSize='small'/>
          </button>
        </Tooltip>
      </KeyInfo>
    </Toolbar>

    {/* zoom */}
    <Toolbar>
      <ZoomButtons showKeys={showKeys} zoom={zoom} setZoom={setZoom}/>
    </Toolbar>

    {/* undo / redo */}
    <Toolbar>
      <UndoRedoButtons
        showKeys={showKeys}
        historyCallbacks={historyCallbacks}
        historyLength={editHistory.history.length}
        futureLength={editHistory.future.length}
      />
    </Toolbar>

    {/* copy / paste */}
    <Toolbar>
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>C</kbd></>}>
        <Tooltip tooltip='copy'>
          <button
            disabled={editHistory.current.selection.size === 0}
            onClick={() => {
              const item = new ClipboardItem({"text/plain": copySelection(editHistory.current, editHistory.current.selection)});
              navigator.clipboard.write([item]);
            }}
          >
            <ContentCopyIcon fontSize='small'/>
          </button>
        </Tooltip>
      </KeyInfo>
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>V</kbd></>}>
        <Tooltip tooltip='paste'>
          <button
            onClick={() => {
              navigator.clipboard.readText().then((text) => {
                const where = {x: 500, y: 100};
                pasteData(text, // <-- data to decode
                  where, // <-- where on the canvas
                  historyCallbacks.commitState, // <-- create new entry in edit history
                  () => startDragging(where)); // <-- pasted shapes follow mouse
              });
            }}
          >
            <ContentPasteIcon fontSize='small'/>
          </button>
        </Tooltip>
      </KeyInfo>
    </Toolbar>

    {/* insert rountangle / arrow / ... */}
    <Toolbar>
      <ToolSelect
        mouseMap={topPanel.mouseMap}
        setMouseMap={setMouseMap}
        showKeys={topPanel.showKeys}
      />
    </Toolbar>

    {/* rotate */}
    <Toolbar>
      <RotateButtons
        disabled={editorState.selection.size === 0}
        onRotate={useCallback((direction: "ccw"|"cw") =>
          historyCallbacks.commitState(editorState =>
            rotateSelection(editorState, direction)),
          [historyCallbacks.commitState])}
      />
    </Toolbar>

    {/* find, replace */}
    <Toolbar>
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd></>}>
        <Tooltip tooltip="find & replace ...">
          <TwoStateButton
            active={showFindReplace}
            onClick={() => setShowFindReplace(x => !x)}
          >
            <FindInPageOutlinedIcon fontSize="small"/>
          </TwoStateButton>
        </Tooltip>
      </KeyInfo>
      <Tooltip tooltip="show debug panel">
        <TwoStateButton
          active={showDebug}
          onClick={() => setShowDebug(x => !x)}
        >
          <BugReportIcon fontSize="small"/>
        </TwoStateButton>
      </Tooltip>
    </Toolbar>

    {/* execution */}
    <Execution
      simulator={simulator}
      showKeys={showKeys}
      displayTime={displayTime}
      refreshDisplayTime={refreshDisplayTime}
    />
  </Toolbar>;
});
