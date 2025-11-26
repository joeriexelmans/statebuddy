import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';

import { usePersistentState } from "@/hooks/usePersistentState";
import { useShortcuts } from "@/hooks/useShortcuts";
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import CachedIcon from '@mui/icons-material/Cached';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import StopIcon from '@mui/icons-material/Stop';
import BugReportIcon from '@mui/icons-material/BugReport';
import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useMemo } from "react";
import { setPaused, setRealtime, TimeMode } from "../../statecharts/time";
import { formatTime } from "../../util/util";
import { AppState, EditHistory } from "../App";
import { Tooltip } from "../Components/Tooltip";
import { TwoStateButton } from "../Components/TwoStateButton";
import { About } from "../Modals/About";
import { VisualEditorState } from "../VisualEditor/VisualEditor";
import { TraceState } from "../hooks/useSimulator";
import { Setters } from "../makePartialSetter";
import { InsertModes } from "./InsertModes";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { RotateButtons } from "./RotateButtons";
import { SpeedControl } from "./SpeedControl";
import { UndoRedoButtons } from "./UndoRedoButtons";
import { ZoomButtons } from "./ZoomButtons";
import { Trial } from '../hooks/useTrial';
import { useUpdater } from '../hooks/useUpdater';

export type TopPanelProps = {
  trial: Trial,
  trace: TraceState | null,
  time: TimeMode,

  originalSize: number,
  compressedSize: number,

  displayTime: number,
  refreshDisplayTime: () => void,
  nextWakeup: number,

  setTime: Dispatch<SetStateAction<TimeMode>>,
  onUndo: () => void,
  onRedo: () => void,
  onRotate: (direction: "ccw"|"cw") => void,
  onInit: () => void,
  onClear: () => void,
  onBack: () => void,
  setModal: Dispatch<SetStateAction<ReactElement|null>>,
  editHistory: EditHistory,
  setEditorState: Dispatch<(oldState: VisualEditorState) => VisualEditorState>,
} & AppState & Setters<AppState>

const ShortCutShowKeys = <kbd>~</kbd>;

function toggle(booleanSetter: Dispatch<(state: boolean) => boolean>) {
  return () => booleanSetter(x => !x);
}

export const TopPanel = memo(function TopPanel({trial, trace, time, setTime, onUndo, onRedo, onRotate, onInit, onClear, onBack, insertMode, setInsertMode, setModal, zoom, setZoom, showKeys, setShowKeys, editHistory, showFindReplace, setShowFindReplace, displayTime, refreshDisplayTime, nextWakeup, modelName, setModelName, originalSize, compressedSize, showDebug, setShowDebug}: TopPanelProps) {
  const [timescale, setTimescale] = usePersistentState("timescale", 1);
  const config = trace && trace.trace[trace.idx];
  const formattedDisplayTime = useMemo(() => formatTime(displayTime), [displayTime]);
  const lastSimTime = config?.simtime || 0;

  const updateAvailable = useUpdater();

  const onChangePaused = useCallback((paused: boolean, wallclktime: number) => {
    setTime(time => {
      if (paused) {
        return setPaused(time, wallclktime);
      }
      else {
        return setRealtime(time, timescale, wallclktime);
      }
    });
    refreshDisplayTime();
  }, [setTime, timescale, refreshDisplayTime]);

  const onSkip = useCallback(() => {
    const now = Math.round(performance.now());
    if (nextWakeup !== Infinity) {
      setTime(time => {
        if (time.kind === "paused") {
          return {kind: "paused", simtime: nextWakeup};
        }
        else {
          return {kind: "realtime", scale: time.scale, since: {simtime: nextWakeup, wallclktime: now}};
        }
      });
    }
  }, [nextWakeup, setTime]);

  const togglePaused = useCallback(() => config && onChangePaused(time.kind !== "paused", Math.round(performance.now())), [config, time]);

  useShortcuts([
    {keys: ["`"], action: toggle(setShowKeys)},
    {keys: ["Ctrl", "Shift", "F"], action: toggle(setShowFindReplace)},
    {keys: ["i"], action: onInit},
    {keys: ["c"], action: onClear},
    {keys: ["Backspace"], action: onBack},
    {keys: [" "], action: togglePaused},
  ]);

  useShortcuts([
    {keys: ["Tab"], action: config && onSkip || onInit},
    {keys: ["Shift", "Tab"], action: onBack},
  ], false); // <-- these shortcuts even steal keyboard events when focused on textboxes (because there is no need to Tab between inputs)

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  const progress = (displayTime-lastSimTime)/(nextWakeup-lastSimTime);
  const catchingUp = progress > 1;

  return <div className="toolbar">
    {/* shortcuts / about */}
    <div className="toolbarGroup">
      <KeyInfo keyInfo={ShortCutShowKeys}>
        <Tooltip tooltip="show/hide keyboard shortcuts" align="left">
        <button className={showKeys?"active":""} onClick={useCallback(() => setShowKeys(s => !s), [setShowKeys])}><KeyboardIcon fontSize="small"/></button>
        </Tooltip>
      </KeyInfo>
      <Tooltip tooltip={updateAvailable ? `${trial.appName} update available!
Refresh the page to get the latest version.` : `about ${trial.appName}`} align="left" showWhen={updateAvailable ? "always" : "hover"}>
        <button onClick={() => setModal(<About setModal={setModal} {...trial}/>)}>
          <InfoOutlineIcon fontSize='small'/>
        </button>
      </Tooltip>
      <Tooltip tooltip={`model size (JSON): ${originalSize} bytes
compressed: ${compressedSize} bytes (${Math.round(compressedSize/originalSize*100)}%)`} align='left'>
      <input
        type="text"
        placeholder='model name'
        value={modelName}
        style={{width:Math.max(modelName.length*6.5, 100)}}
        onChange={e => setModelName(e.target.value)}
        />
      </Tooltip>
      &emsp;
    </div>

    {/* zoom */}
    <div className="toolbarGroup">
      <ZoomButtons showKeys={showKeys} zoom={zoom} setZoom={setZoom}/>
      &emsp;
    </div>

    {/* undo / redo */}
    <div className="toolbarGroup">
      <UndoRedoButtons showKeys={showKeys} onUndo={onUndo} onRedo={onRedo} historyLength={editHistory.history.length} futureLength={editHistory.future.length}/>
      &emsp;
    </div>

    {/* insert rountangle / arrow / ... */}
    <div className="toolbarGroup">
      <InsertModes insertMode={insertMode} setInsertMode={setInsertMode} showKeys={showKeys}/>
      &emsp;
    </div>

    {/* rotate */}
    <div className="toolbarGroup">
      <RotateButtons selection={editHistory.current.selection} onRotate={onRotate}/>
      &emsp;
    </div>

    {/* find, replace */}
    <div className="toolbarGroup">
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd></>}>
        <Tooltip tooltip="find & replace ...">
          <TwoStateButton
            active={showFindReplace}
            onClick={() => setShowFindReplace(x => !x)}
          >
            <FindInPageOutlinedIcon fontSize="small"/>
          </TwoStateButton>
        </Tooltip>
        <Tooltip tooltip="show debug panel">
          <TwoStateButton
            active={showDebug}
            onClick={() => setShowDebug(x => !x)}
          >
            <BugReportIcon fontSize="small"/>
          </TwoStateButton>
        </Tooltip>
      </KeyInfo>
      &emsp;
    </div>

    {/* execution */}
    <div className="toolbarGroup">

      <div className="toolbarGroup">
        {/* init / clear */}
        <KeyInfo keyInfo={<kbd>I</kbd>}>
          <Tooltip tooltip="(re)initialize simulation">
            <button onClick={onInit} ><PlayArrowIcon fontSize="small"/>
              <CachedIcon fontSize="small"/>
            </button>
          </Tooltip>
        </KeyInfo>
        <KeyInfo keyInfo={<kbd>C</kbd>}>
          <Tooltip tooltip="clear the simulation">
            <button onClick={onClear} disabled={!config}>
              <StopIcon fontSize="small"/>
            </button>
          </Tooltip>
        </KeyInfo>
        &emsp;
        {/* pause / real time */}
        <KeyInfo keyInfo={<><kbd>Space</kbd> toggles</>}>
          <Tooltip tooltip="pause simulation">
            <TwoStateButton
              active={config !== null && time.kind==="paused"}
              disabled={config === null}
              onClick={togglePaused}
            >
              <PauseIcon fontSize="small"/>
            </TwoStateButton>
          </Tooltip>
          <Tooltip tooltip="run simulation in real time">
            <TwoStateButton
              active={config !== null && time.kind==="realtime"}
              disabled={config === null}
              onClick={togglePaused}
            >
              <PlayArrowIcon fontSize="small"/>
            </TwoStateButton>
          </Tooltip>
        </KeyInfo>
        &emsp;
      </div>

      {/* speed */}
      <div className="toolbarGroup">
        <SpeedControl setTime={setTime} timescale={timescale} setTimescale={setTimescale} showKeys={showKeys} />
        &emsp;
      </div>

      {/* time, next */}
      <div className="toolbarGroup">
        <div className="toolbarGroup">
          <Tooltip tooltip="current simulated time">
            <label htmlFor="input-time"><AccessTimeIcon fontSize="small"/></label>&nbsp;
            <div style={{
              position: 'absolute',
              marginTop: -4,
              marginLeft: 20,
              height: 4,
              borderWidth: 0,
              backgroundColor: catchingUp
                ? 'var(--firing-transition-color)'
                : 'var(--accent-border-color)',
              width: Math.min(progress, 1)*56,
              }}
              title={catchingUp
                ? "running behind schedule! (maybe slow down a bit so i can catch up?)"
                : "are we there yet?"}
              />
            <input id="input-time"
              disabled={!config}
              value={formattedDisplayTime}
              readOnly={true}
              className="readonlyTextBox" />
          </Tooltip>

        </div>

        &emsp;
        <div className="toolbarGroup">
          <Tooltip tooltip="next timed transition occurs at ...">
            <label htmlFor="next-timeout"><AccessAlarmIcon fontSize="small"/></label>&nbsp;
            <input
              id="next-timeout"
              disabled={!config}
              value={formatTime(nextWakeup)}
              readOnly={true}
              className="readonlyTextBox"
            />
          </Tooltip>
          <KeyInfo keyInfo={<kbd>Tab</kbd>}>
            <Tooltip tooltip="jump to next timed transition" align="right">
              <button
                disabled={nextWakeup === Infinity}
                onClick={onSkip}>
                <SkipNextIcon fontSize="small"/>
              </button>
            </Tooltip>
          </KeyInfo>
          &emsp;
        </div>
      </div>
    </div>
  </div>;
});
