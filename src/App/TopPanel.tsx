import { Dispatch, ReactElement, SetStateAction, useEffect, useState } from "react";
import { BigStep, TimerElapseEvent, Timers } from "../statecharts/runtime_types";
import { getSimTime, setPaused, setRealtime, TimeMode } from "../statecharts/time";
import { Statechart } from "../statecharts/abstract_syntax";

import CachedIcon from '@mui/icons-material/Cached';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BoltIcon from '@mui/icons-material/Bolt';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import StopIcon from '@mui/icons-material/Stop';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';

import { formatTime } from "./util";
import { InsertMode } from "../VisualEditor/VisualEditor";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { About } from "./About";
import { usePersistentState } from "@/util/persistent_state";
import { RountangleIcon, PseudoStateIcon, HistoryIcon } from "./Icons";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/VisualEditor/parameters";

export type TopPanelProps = {
  rt?: BigStep,
  rtIdx?: number,
  time: TimeMode,
  setTime: Dispatch<SetStateAction<TimeMode>>,
  onUndo: () => void,
  onRedo: () => void,
  onInit: () => void,
  onClear: () => void,
  onRaise: (e: string, p: any) => void,
  onBack: () => void,
  ast: Statechart,
  mode: InsertMode,
  setMode: Dispatch<SetStateAction<InsertMode>>,
  setModal: Dispatch<SetStateAction<ReactElement|null>>,
  zoom: number,
  setZoom: Dispatch<SetStateAction<number>>,
  showKeys: boolean,
  setShowKeys: Dispatch<SetStateAction<boolean>>,
}

export function TopPanel({rt, rtIdx, time, setTime, onUndo, onRedo, onInit, onClear, onRaise, onBack, ast, mode, setMode, setModal, zoom, setZoom, showKeys, setShowKeys}: TopPanelProps) {
  const [displayTime, setDisplayTime] = useState("0.000");
  const [timescale, setTimescale] = useState(1);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) {
        if (e.key === " ") {
          e.preventDefault();
          if (rt)
          onChangePaused(time.kind !== "paused", Math.round(performance.now()));
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
          if (rtIdx === undefined) {
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
        if (e.key === "+") {
          e.preventDefault();
          onZoomIn();
        }
        if (e.key === "-") {
          e.preventDefault();
          onZoomOut();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [time, onInit, timescale]);

  function updateDisplayedTime() {
    const now = Math.round(performance.now());
    const timeMs = getSimTime(time, now);
    setDisplayTime(formatTime(timeMs));
  }

  useEffect(() => {
    // This has no effect on statechart execution. In between events, the statechart is doing nothing. However, by updating the displayed time, we give the illusion of continuous progress.
    const interval = setInterval(() => {
      updateDisplayedTime();
    }, 43); // every X ms -> we want a value that makes the numbers 'dance' while not using too much CPU
    return () => {
      clearInterval(interval);
    }
  }, [time]);

  function onZoomIn() {
    setZoom(zoom => Math.min(zoom * ZOOM_STEP, ZOOM_MAX));
  }
  function onZoomOut() {
    setZoom(zoom => Math.max(zoom / ZOOM_STEP, ZOOM_MIN));
  }

  function onChangePaused(paused: boolean, wallclktime: number) {
    setTime(time => {
      if (paused) {
        return setPaused(time, wallclktime);
      }
      else {
        return setRealtime(time, timescale, wallclktime);
      }
    });
    updateDisplayedTime();
  }

  function onTimeScaleChange(newValue: string, wallclktime: number) {
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
  }

  // timestamp of next timed transition, in simulated time
  const timers: Timers = (rt?.environment.get("_timers") || []);
  const nextTimedTransition: [number, TimerElapseEvent] | undefined = timers[0];

  function onSkip() {
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
  }

  function onSlower() {
    onTimeScaleChange((timescale/2).toString(), Math.round(performance.now()));
  }
  function onFaster() {
    onTimeScaleChange((timescale*2).toString(), Math.round(performance.now()));
  }

  return <div className="toolbar">

    {/* shortcuts / about */}
    <div className="toolbarGroup">
      <KeyInfo keyInfo={<kbd>~</kbd>}>
        <button title="show/hide keyboard shortcuts" className={showKeys?"active":""} onClick={() => setShowKeys(s => !s)}><KeyboardIcon fontSize="small"/></button>
      </KeyInfo>
      <button title="about StateBuddy" onClick={() => setModal(<About setModal={setModal}/>)}><InfoOutlineIcon fontSize="small"/></button>
      &emsp;
    </div>

    {/* zoom */}
    <div className="toolbarGroup">
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>-</kbd></>}>
        <button title="zoom out" onClick={onZoomOut} disabled={zoom <= ZOOM_MIN}><ZoomOutIcon fontSize="small"/></button>
      </KeyInfo>
      <input title="current zoom level" value={zoom.toFixed(3)} style={{width:40}} readOnly/>
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>+</kbd></>}>
        <button title="zoom in" onClick={onZoomIn} disabled={zoom >= ZOOM_MAX}><ZoomInIcon fontSize="small"/></button>
      </KeyInfo>
      &emsp;
    </div>

    {/* undo / redo */}
    <div className="toolbarGroup">
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Z</kbd></>}>
        <button title="undo" onClick={onUndo}><UndoIcon fontSize="small"/></button>
      </KeyInfo>
      <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></>}>
        <button title="redo" onClick={onRedo}><RedoIcon fontSize="small"/></button>
      </KeyInfo>
      &emsp;
    </div>

    {/* insert rountangle / arrow / ... */}
    <div className="toolbarGroup">
      {([
        ["and", "AND-states", <RountangleIcon kind="and"/>, <kbd>A</kbd>],
        ["or", "OR-states", <RountangleIcon kind="or"/>, <kbd>O</kbd>],
        ["pseudo", "pseudo-states", <PseudoStateIcon/>, <kbd>P</kbd>],
        ["shallow", "shallow history", <HistoryIcon kind="shallow"/>, <kbd>H</kbd>],
        ["deep", "deep history", <HistoryIcon kind="deep"/>, <></>],
        ["transition", "transitions", <TrendingFlatIcon fontSize="small"/>, <kbd>T</kbd>],
        ["text", "text", <>&nbsp;T&nbsp;</>, <kbd>X</kbd>],
      ] as [InsertMode, string, ReactElement, ReactElement][]).map(([m, hint, buttonTxt, keyInfo]) =>
        <KeyInfo key={m} keyInfo={keyInfo}>
        <button
          title={"insert "+hint}
          disabled={mode===m}
          className={mode===m ? "active":""}
          onClick={() => setMode(m)}
        >{buttonTxt}</button></KeyInfo>)}
      &emsp;
    </div>

    {/* execution */}
    <div className="toolbarGroup">

      {/* init / clear / pause / real time */}
      <div className="toolbarGroup">
        <KeyInfo keyInfo={<kbd>I</kbd>}>
          <button title="(re)initialize simulation" onClick={onInit} ><PlayArrowIcon fontSize="small"/><CachedIcon fontSize="small"/></button>
        </KeyInfo>
        <KeyInfo keyInfo={<kbd>C</kbd>}>
          <button title="clear the simulation" onClick={onClear} disabled={!rt}><StopIcon fontSize="small"/></button>
        </KeyInfo>
        &emsp;
        <KeyInfo keyInfo={<><kbd>Space</kbd> toggles</>}>
          <button title="pause the simulation" disabled={!rt || time.kind==="paused"} className={(rt && time.kind==="paused") ? "active":""} onClick={() => onChangePaused(true, Math.round(performance.now()))}><PauseIcon fontSize="small"/></button>
          <button title="run the simulation in real time" disabled={!rt || time.kind==="realtime"} className={(rt && time.kind==="realtime") ? "active":""} onClick={() => onChangePaused(false, Math.round(performance.now()))}><PlayArrowIcon fontSize="small"/></button>
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
          <input title="the current simulated time" id="time" disabled={!rt} value={displayTime} readOnly={true} className="readonlyTextBox" />
        </div>
        &emsp;
        <div className="toolbarGroup">
          <label htmlFor="next-timeout">next (s)</label>&nbsp;
          <input title="next point in simulated time where a timed transition may fire" id="next-timeout" disabled={!rt} value={nextTimedTransition ? formatTime(nextTimedTransition[0]) : '+inf'} readOnly={true} className="readonlyTextBox"/>
          <KeyInfo keyInfo={<kbd>Tab</kbd>}>
            <button title="advance time just enough for the next timer to elapse" disabled={nextTimedTransition===undefined} onClick={onSkip}><SkipNextIcon fontSize="small"/><AccessAlarmIcon fontSize="small"/></button>
          </KeyInfo>
          &emsp;
        </div>
      </div>
    </div>

    {/* input events */}
    {/* <div className="toolbarGroup">
      {ast.inputEvents &&
        <>
          {ast.inputEvents.map(({event, paramName}) =>
            <div key={event+'/'+paramName} className="toolbarGroup">
              <button
                className="inputEvent"
                title={`raise this input event`}
                disabled={!rt}
                onClick={() => {
                  // @ts-ignore
                  const param = document.getElementById(`input-${event}-param`)?.value;
                  let paramParsed;
                  try {
                    if (param) {
                      paramParsed = JSON.parse(param); // may throw
                    }
                  }
                  catch (e) {
                    alert("invalid json");
                    return;
                  }
                  onRaise(event, paramParsed);
                }}>
                <BoltIcon fontSize="small"/>
                {event}
              </button>
              {paramName &&
                <><input id={`input-${event}-param`} style={{width: 20}} placeholder={paramName}/></>
              }
              &nbsp;
            </div>
          )}
        </>
      }
    </div> */}

  </div>;
}
