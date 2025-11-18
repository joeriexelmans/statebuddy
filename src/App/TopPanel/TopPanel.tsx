import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { TimerElapseEvent, Timers } from "../../statecharts/runtime_types";
import { getSimTime, setPaused, setRealtime, TimeMode } from "../../statecharts/time";
import { About } from "../Modals/About";
import { AppState, EditHistory, LightMode } from "../App";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { UndoRedoButtons } from "./UndoRedoButtons";
import { ZoomButtons } from "./ZoomButtons";
import { formatTime } from "../../util/util";

import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';

import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';

import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import CachedIcon from '@mui/icons-material/Cached';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import StopIcon from '@mui/icons-material/Stop';
import { InsertModes } from "./InsertModes";
import { usePersistentState } from "@/hooks/usePersistentState";
import { RotateButtons } from "./RotateButtons";
import { SpeedControl } from "./SpeedControl";
import { TraceState } from "../hooks/useSimulator";
import { FindReplace } from "../BottomPanel/FindReplace";
import { VisualEditorState } from "../VisualEditor/VisualEditor";
import { Setters } from "../makePartialSetter";
import { TwoStateButton } from "../Components/TwoStateButton";
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../Components/Tooltip";

export type TopPanelProps = {
  trace: TraceState | null,
  time: TimeMode,

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

export const TopPanel = memo(function TopPanel({trace, time, setTime, onUndo, onRedo, onRotate, onInit, onClear, onBack, insertMode, setInsertMode, setModal, zoom, setZoom, showKeys, setShowKeys, editHistory, showFindReplace, setShowFindReplace, displayTime, refreshDisplayTime, nextWakeup}: TopPanelProps) {
  const [timescale, setTimescale] = usePersistentState("timescale", 1);
  const config = trace && trace.trace[trace.idx];
  const formattedDisplayTime = useMemo(() => formatTime(displayTime), [displayTime]);
  const lastSimTime = config?.simtime || 0;

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
    {keys: ["Tab"], action: config && onSkip || onInit},
    {keys: ["Backspace"], action: onBack},
    {keys: ["Shift", "Tab"], action: onBack},
    {keys: [" "], action: togglePaused},
  ]);

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
      <Tooltip tooltip="about StateBuddy" align="left">
        <button onClick={() => setModal(<About setModal={setModal}/>)}>
          <InfoOutlineIcon fontSize="small"/>
        </button>
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
        <Tooltip tooltip="find & replace ..." align="right">
          <TwoStateButton
            active={showFindReplace}
            onClick={() => setShowFindReplace(x => !x)}
          >
            <FindInPageOutlinedIcon fontSize="small"/>
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
          <Tooltip tooltip="(re)initialize simulation" align="left">
            <button onClick={onInit} ><PlayArrowIcon fontSize="small"/>
              <CachedIcon fontSize="small"/>
            </button>
          </Tooltip>
        </KeyInfo>
        <KeyInfo keyInfo={<kbd>C</kbd>}>
          <Tooltip tooltip="clear the simulation" align="left">
            <button onClick={onClear} disabled={!config}>
              <StopIcon fontSize="small"/>
            </button>
          </Tooltip>
        </KeyInfo>
        &emsp;
        {/* pause / real time */}
        <KeyInfo keyInfo={<><kbd>Space</kbd> toggles</>}>
          <Tooltip tooltip="pause simulation" align="left">
            <TwoStateButton
              active={config !== null && time.kind==="paused"}
              disabled={config === null}
              onClick={togglePaused}
            >
              <PauseIcon fontSize="small"/>
            </TwoStateButton>
          </Tooltip>
          <Tooltip tooltip="run simulation in real time" align="left">
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
          <Tooltip tooltip="current simulated time" align="right">
            <label htmlFor="time"><AccessTimeIcon fontSize="small"/></label>&nbsp;
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
            <input id="time"
              disabled={!config}
              value={formattedDisplayTime}
              readOnly={true}
              className="readonlyTextBox" />
          </Tooltip>

        </div>

        &emsp;
        <div className="toolbarGroup">
          <Tooltip tooltip="next timed transition occurs at ..." align="right">
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
                disabled={nextWakeup !== Infinity}
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
