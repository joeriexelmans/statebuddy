import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useEffect, useState } from "react";
import { TimerElapseEvent, Timers } from "../../statecharts/runtime_types";
import { getSimTime, setPaused, setRealtime, TimeMode } from "../../statecharts/time";
import { InsertMode } from "../VisualEditor/VisualEditor";
import { About } from "../Modals/About";
import { EditHistory, TraceState } from "../App";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { UndoRedoButtons } from "./UndoRedoButtons";
import { ZoomButtons } from "./ZoomButtons";
import { formatTime } from "../../util/util";

import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import CachedIcon from '@mui/icons-material/Cached';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import StopIcon from '@mui/icons-material/Stop';
import { InsertModes } from "./InsertModes";
import { usePersistentState } from "@/App/persistent_state";

export type TopPanelProps = {
  trace: TraceState | null,
  time: TimeMode,
  setTime: Dispatch<SetStateAction<TimeMode>>,
  onUndo: () => void,
  onRedo: () => void,
  onInit: () => void,
  onClear: () => void,
  onBack: () => void,
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

export const TopPanel = memo(function TopPanel({trace, time, setTime, onUndo, onRedo, onInit, onClear, onBack, insertMode, setInsertMode, setModal, zoom, setZoom, showKeys, setShowKeys, editHistory}: TopPanelProps) {
  const [displayTime, setDisplayTime] = useState("0.000");
  const [timescale, setTimescale] = usePersistentState("timescale", 1);

  const config = trace && trace.trace[trace.idx];

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  const updateDisplayedTime = useCallback(() => {
    const now = Math.round(performance.now());
    const timeMs = getSimTime(time, now);
    setDisplayTime(formatTime(timeMs));
  }, [time, setDisplayTime]);

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

  const onTimeScaleChange = useCallback((newValue: string, wallclktime: number) => {
    const asFloat = parseFloat(newValue);
    if (Number.isNaN(asFloat)) {
      return;
    }
    const maxed = Math.min(asFloat, 64);
    const mined = Math.max(maxed, 1/64);
    setTimescale(mined);
    setTime(time => {
      if (time.kind === "paused") {
        return time;
      }
      else {
        return setRealtime(time, mined, wallclktime);
      }
    });
  }, [setTime, setTimescale]);

  // timestamp of next timed transition, in simulated time
  const timers: Timers = config?.kind === "bigstep" && config.environment.get("_timers") || [];
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

  const onSlower = useCallback(() => {
    onTimeScaleChange((timescale/2).toString(), Math.round(performance.now()));
  }, [onTimeScaleChange, timescale]);
  const onFaster = useCallback(() => {
    onTimeScaleChange((timescale*2).toString(), Math.round(performance.now()));
  }, [onTimeScaleChange, timescale]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
          if (trace === null) {
            onInit();
          }
          else {
            onSkip();
          }
          e.preventDefault();
        }
        if (e.key === "s") {
          e.preventDefault();
          onSlower();
        }
        if (e.key === "f") {
          e.preventDefault();
          onFaster();
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
      else {
        // ctrl is down
        if (e.key === "z") {
          e.preventDefault();
          onUndo();
        }
        if (e.key === "Z") {
          e.preventDefault();
          onRedo();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [trace, config, time, onInit, timescale, onChangePaused, setShowKeys, onUndo, onRedo, onSlower, onFaster, onSkip, onBack, onClear]);

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
        <label htmlFor="number-timescale">speed</label>&nbsp;
        <KeyInfo keyInfo={<kbd>S</kbd>}>
          <button title="slower" onClick={onSlower}>÷2</button>
        </KeyInfo>
        <input title="controls how fast the simulation should run in real time mode - larger than 1 means: faster than wall-clock time" id="number-timescale" value={timescale.toFixed(3)} style={{width:40}} readOnly onChange={e => onTimeScaleChange(e.target.value, Math.round(performance.now()))}/>
        <KeyInfo keyInfo={<kbd>F</kbd>}>
          <button title="faster" onClick={onFaster}>×2</button>
        </KeyInfo>
        &emsp;
      </div>

      {/* time, next */}
      <div className="toolbarGroup">
        <div className="toolbarGroup">
          <label htmlFor="time">time (s)</label>&nbsp;
          <input title="the current simulated time" id="time" disabled={!config} value={displayTime} readOnly={true} className="readonlyTextBox" />
        </div>
        &emsp;
        <div className="toolbarGroup">
          <label htmlFor="next-timeout">next (s)</label>&nbsp;
          <input title="next point in simulated time where a timed transition may fire" id="next-timeout" disabled={!config} value={nextTimedTransition ? formatTime(nextTimedTransition[0]) : '+inf'} readOnly={true} className="readonlyTextBox"/>
          <KeyInfo keyInfo={<kbd>Tab</kbd>}>
            <button title="advance time just enough for the next timer to elapse" disabled={nextTimedTransition===undefined} onClick={onSkip}><SkipNextIcon fontSize="small"/><AccessAlarmIcon fontSize="small"/></button>
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
