import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { TimerElapseEvent, Timers } from "../../statecharts/runtime_types";
import { getSimTime, setPaused, setRealtime, TimeMode } from "../../statecharts/time";
import { InsertMode } from "./InsertModes";
import { About } from "../Modals/About";
import { EditHistory, LightMode } from "../App";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { UndoRedoButtons } from "./UndoRedoButtons";
import { ZoomButtons } from "./ZoomButtons";
import { formatTime } from "../../util/util";

import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';

import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

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

export type TopPanelProps = {
  trace: TraceState | null,
  time: TimeMode,
  setTime: Dispatch<SetStateAction<TimeMode>>,
  onUndo: () => void,
  onRedo: () => void,
  onRotate: (direction: "ccw"|"cw") => void,
  onInit: () => void,
  onClear: () => void,
  onBack: () => void,
  // lightMode: LightMode,
  // setLightMode: Dispatch<SetStateAction<LightMode>>,
  insertMode: InsertMode,
  setInsertMode: Dispatch<SetStateAction<InsertMode>>,
  setModal: Dispatch<SetStateAction<ReactElement|null>>,
  zoom: number,
  setZoom: Dispatch<SetStateAction<number>>,
  showKeys: boolean,
  setShowKeys: Dispatch<SetStateAction<boolean>>,
  editHistory: EditHistory,
}

const ShortCutShowKeys = <kbd>~</kbd>;

export const TopPanel = memo(function TopPanel({trace, time, setTime, onUndo, onRedo, onRotate, onInit, onClear, onBack, insertMode, setInsertMode, setModal, zoom, setZoom, showKeys, setShowKeys, editHistory}: TopPanelProps) {
  const [displayTime, setDisplayTime] = useState(0);
  const [timescale, setTimescale] = usePersistentState("timescale", 1);

  const config = trace && trace.trace[trace.idx];

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  const updateDisplayedTime = useCallback(() => {
    const now = Math.round(performance.now());
    const timeMs = getSimTime(time, now);
    setDisplayTime((timeMs));
  }, [time, setDisplayTime]);

  const formattedDisplayTime = useMemo(() => formatTime(displayTime), [displayTime]);

  // const lastSimTime = useMemo(() => time.kind === "realtime" ? time.since.simtime : time.simtime, [time]);

  const lastSimTime = config?.simtime || 0;


  useEffect(() => {
    // This has no effect on statechart execution. In between events, the statechart is doing nothing. However, by updating the displayed time, we give the illusion of continuous progress.
    const interval = setInterval(() => {
      updateDisplayedTime();
    }, 43); // every X ms -> we want a value that makes the numbers 'dance' while not using too much CPU
    return () => {
      clearInterval(interval);
    }
  }, [time, updateDisplayedTime]);

  const onChangePaused = useCallback((paused: boolean, wallclktime: number) => {
    setTime(time => {
      if (paused) {
        return setPaused(time, wallclktime);
      }
      else {
        return setRealtime(time, timescale, wallclktime);
      }
    });
    updateDisplayedTime();
  }, [setTime, timescale, updateDisplayedTime]);

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


  console.log({lastSimTime, displayTime, nxt: nextTimedTransition?.[0]});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // don't capture keyboard events when focused on an input element:
      // @ts-ignore
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;

      if (!e.ctrlKey) {
        if (e.key === " ") {
          e.preventDefault();
          if (config) {
            onChangePaused(time.kind !== "paused", Math.round(performance.now()));
          }
        };
        if (e.key === "i") {
          e.preventDefault();
          onInit();
        }
        if (e.key === "c") {
          e.preventDefault();
          onClear();
        }
        if (e.key === "Tab") {
          if (config === null) {
            onInit();
          }
          else {
            onSkip();
          }
          e.preventDefault();
        }
        if (e.key === "`") {
          e.preventDefault();
          setShowKeys(show => !show);
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          onBack();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [config, time, onInit, onChangePaused, setShowKeys, onSkip, onBack, onClear]);

  return <div className="toolbar">

    {/* light / dark mode
    <div className="toolbarGroup">
      <button title="force light mode" className={lightMode==="light"?"active":""} onClick={() => setLightMode("light")}>
        <LightModeIcon fontSize="small"/>
      </button>
      <button title="auto light / dark mode (follows system theme)" className={lightMode==="auto"?"active":""} onClick={() => setLightMode("auto")}>
        <BrightnessAutoIcon fontSize="small"/>
      </button>
      <button title="force dark mode" className={lightMode==="dark"?"active":""} onClick={() => setLightMode("dark")}>
        <DarkModeIcon fontSize="small"/>
      </button>
      &emsp;
    </div> */}

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

    <div className="toolbarGroup">
      <RotateButtons selection={editHistory.current.selection} onRotate={onRotate}/>
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
          <progress style={{position:'absolute', width: 60, marginTop: 23, height: 2, background: 'rgba(0,0,0,0)', border: 0, accentColor: 'var(--accent-border-color)', appearance: 'none'}} max={1} value={(displayTime-lastSimTime)/((nextTimedTransition?.[0]||Infinity)-lastSimTime)}/>
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
    <div className="toolbarGroup">
      {location.host === "localhost:3000" ?
        <a href={`https://deemz.org/public/statebuddy/${location.hash}`}>production</a>
        : <a href={`http://localhost:3000/${location.hash}`}>development</a>
      }
    </div>
  </div>;
});
