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

export type TopPanelProps = {
  trace: TraceState | null,
  time: TimeMode,

  displayTime: number,
  refreshDisplayTime: () => void,

  setTime: Dispatch<SetStateAction<TimeMode>>,
  onUndo: () => void,
  onRedo: () => void,
  onRotate: (direction: "ccw"|"cw") => void,
  onInit: () => void,
  onClear: () => void,
  onBack: () => void,

  // lightMode: LightMode,
  // setLightMode: Dispatch<SetStateAction<LightMode>>,
  // insertMode: InsertMode,
  // setInsertMode: Dispatch<SetStateAction<InsertMode>>,
  setModal: Dispatch<SetStateAction<ReactElement|null>>,
  // zoom: number,
  // setZoom: Dispatch<SetStateAction<number>>,
  // showKeys: boolean,
  // setShowKeys: Dispatch<SetStateAction<boolean>>,
  editHistory: EditHistory,
  setEditorState: Dispatch<(oldState: VisualEditorState) => VisualEditorState>,
} & AppState & Setters<AppState>

const ShortCutShowKeys = <kbd>~</kbd>;

function toggle(booleanSetter: Dispatch<(state: boolean) => boolean>) {
  return () => booleanSetter(x => !x);
}

export const TopPanel = memo(function TopPanel({trace, time, setTime, onUndo, onRedo, onRotate, onInit, onClear, onBack, insertMode, setInsertMode, setModal, zoom, setZoom, showKeys, setShowKeys, editHistory, showFindReplace, setShowFindReplace, displayTime, refreshDisplayTime}: TopPanelProps) {
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

  // timestamp of next timed transition, in simulated time
  const timers: Timers = config?.kind === "bigstep" && config.state.sc.environment.get("_timers") || [];
  const nextTimedTransition: [number, TimerElapseEvent] | undefined = timers[0];

  const onSkip = useCallback(() => {
    const now = Math.round(performance.now());
    if (nextTimedTransition) {
      setTime(time => {
        if (time.kind === "paused") {
          return {kind: "paused", simtime: nextTimedTransition[0]};
        }
        else {
          return {kind: "realtime", scale: time.scale, since: {simtime: nextTimedTransition[0], wallclktime: now}};
        }
      });
    }
  }, [nextTimedTransition, setTime]);

  useShortcuts([
    {keys: ["`"], action: toggle(setShowKeys)},
    {keys: ["Ctrl", "Shift", "F"], action: toggle(setShowFindReplace)},
    {keys: ["i"], action: onInit},
    {keys: ["c"], action: onClear},
    {keys: ["Tab"], action: config && onSkip || onInit},
    {keys: ["Backspace"], action: onBack},
    {keys: ["Shift", "Tab"], action: onBack},
    {keys: [" "], action: () => config && onChangePaused(time.kind !== "paused", Math.round(performance.now()))},
  ]);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  return <div className="toolbar">

    {/* shortcuts / about */}
    <div className="toolbarGroup">
      <KeyInfo keyInfo={ShortCutShowKeys}>
        <button title="show/hide keyboard shortcuts" className={showKeys?"active":""} onClick={useCallback(() => setShowKeys(s => !s), [setShowKeys])}><KeyboardIcon fontSize="small"/></button>
      </KeyInfo>
      <button title="about StateBuddy" onClick={() => setModal(<About setModal={setModal}/>)}><InfoOutlineIcon fontSize="small"/></button>
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
        <TwoStateButton
          title="show find & replace"
          active={showFindReplace}
          onClick={() => setShowFindReplace(x => !x)}
        >
          <FindInPageOutlinedIcon fontSize="small"/>
        </TwoStateButton>
      </KeyInfo>
      &emsp;
    </div>

    {/* execution */}
    <div className="toolbarGroup">

      <div className="toolbarGroup">
        {/* init / clear */}
        <KeyInfo keyInfo={<kbd>I</kbd>}>
          <button title="(re)initialize simulation" onClick={onInit} ><PlayArrowIcon fontSize="small"/><CachedIcon fontSize="small"/></button>
        </KeyInfo>
        <KeyInfo keyInfo={<kbd>C</kbd>}>
          <button title="clear the simulation" onClick={onClear} disabled={!config}><StopIcon fontSize="small"/></button>
        </KeyInfo>
        &emsp;
        {/* pause / real time */}
        <KeyInfo keyInfo={<><kbd>Space</kbd> toggles</>}>
          <button title="pause the simulation" disabled={!config || time.kind==="paused"} className={(config && time.kind==="paused") ? "active":""} onClick={() => onChangePaused(true, Math.round(performance.now()))}><PauseIcon fontSize="small"/></button>
          <button title="run the simulation in real time" disabled={!config || time.kind==="realtime"} className={(config && time.kind==="realtime") ? "active":""} onClick={() => onChangePaused(false, Math.round(performance.now()))}><PlayArrowIcon fontSize="small"/></button>
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
          <label htmlFor="time"><AccessTimeIcon fontSize="small"/></label>&nbsp;
          <div style={{
            position: 'absolute',
            marginTop: -4,
            marginLeft: 20,
            height: 4,
            borderWidth: 0,
            backgroundColor: 'var(--accent-border-color)',
            width: (displayTime-lastSimTime)/((nextTimedTransition?.[0]||Infinity)-lastSimTime)*55,
            }}/>
          <input title="the current simulated time" id="time" disabled={!config} value={formattedDisplayTime} readOnly={true} className="readonlyTextBox" />

        </div>

        &emsp;
        <div className="toolbarGroup">
          <label htmlFor="next-timeout"><AccessAlarmIcon fontSize="small"/></label>&nbsp;
          <input title="next point in simulated time where a timed transition may fire" id="next-timeout" disabled={!config} value={nextTimedTransition ? formatTime(nextTimedTransition[0]) : '+inf'} readOnly={true} className="readonlyTextBox"/>
          <KeyInfo keyInfo={<kbd>Tab</kbd>}>
            <button title="advance time just enough for the next timer to elapse" disabled={nextTimedTransition===undefined} onClick={onSkip}>
              <SkipNextIcon fontSize="small"/>
            </button>
          </KeyInfo>
          &emsp;
        </div>
      </div>
    </div>
  </div>;
});
