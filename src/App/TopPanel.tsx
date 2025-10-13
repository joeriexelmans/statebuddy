import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { BigStep, TimerElapseEvent, Timers } from "../statecharts/runtime_types";
import { getSimTime, setPaused, setRealtime, TimeMode } from "../statecharts/time";
import { Statechart } from "../statecharts/abstract_syntax";

import CachedIcon from '@mui/icons-material/Cached';
import ClearIcon from '@mui/icons-material/Clear';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BoltIcon from '@mui/icons-material/Bolt';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { formatTime } from "./util";

export type TopPanelProps = {
  rt?: BigStep,
  time: TimeMode,
  setTime: Dispatch<SetStateAction<TimeMode>>,
  onInit: () => void,
  onClear: () => void,
  onRaise: (e: string) => void,
  ast: Statechart,
}

export function TopPanel({rt, time, setTime, onInit, onClear, onRaise, ast}: TopPanelProps) {
  const [displayTime, setDisplayTime] = useState("0.000");
  const [timescale, setTimescale] = useState(1);

  function updateDisplayedTime() {
    const now = performance.now();
    const timeMs = getSimTime(time, now);
    setDisplayTime(formatTime(timeMs));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      updateDisplayedTime();
    }, 20);
    return () => {
      clearInterval(interval);
    }
  }, [time]);

  function onChangePaused(paused: boolean, wallclktime: number) {
    setTime(time => {
      if (paused) {
        return setPaused(time, performance.now());
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

  return <div className="toolbar">
    <button title="(re)initialize simulation" onClick={onInit} ><CachedIcon fontSize="small"/></button>
    <button title="clear the simulation" onClick={onClear} disabled={!rt}><ClearIcon fontSize="small"/></button>

    &emsp;

    <button title="pause the simulation" disabled={!rt || time.kind==="paused"} onClick={() => onChangePaused(true, performance.now())}><PauseIcon fontSize="small"/></button>
    <button title="run the simulation in real time" disabled={!rt || time.kind==="realtime"} onClick={() => onChangePaused(false, performance.now())}><PlayArrowIcon fontSize="small"/></button>

    &emsp;

    <label htmlFor="number-timescale">timescale</label>&nbsp;
    <button title="slower" onClick={() => onTimeScaleChange((timescale/2).toString(), performance.now())}>÷2</button>
    <input title="controls how fast the simulation should run in real time mode - larger than 1 means: faster than wall-clock time" id="number-timescale" value={timescale.toFixed(3)} style={{width:40}} readOnly onChange={e => onTimeScaleChange(e.target.value, performance.now())}/>
    <button title="faster" onClick={() => onTimeScaleChange((timescale*2).toString(), performance.now())}>×2</button>

    &emsp;

    {ast.inputEvents &&
      <>
        {[...ast.inputEvents].map(event => <button title={`raise input event '${event}'`} disabled={!rt} onClick={() => onRaise(event)}><BoltIcon fontSize="small"/> {event}</button>)}
      &emsp;</>
    }

    {/* <ToggleButtonGroup value={time.kind} exclusive onChange={(_,newValue) => onChangePaused(newValue==="paused", performance.now())} size="small">
      <ToggleButton disableRipple value="paused" disabled={!rt}><PauseIcon/></ToggleButton>
      <ToggleButton disableRipple value="realtime" disabled={!rt}><PlayArrowIcon/></ToggleButton>
    </ToggleButtonGroup> */}

    &emsp;

    <label htmlFor="time">time (s)</label>&nbsp;
    <input title="the current simulated time" id="time" disabled={!rt} value={displayTime} readOnly={true} className="readonlyTextBox" />

    &emsp;

    <label htmlFor="next-timeout">next (s)</label>&nbsp;
    <input title="next point in simulated time where a timed transition may fire" id="next-timeout" disabled={!rt} value={nextTimedTransition ? formatTime(nextTimedTransition[0]) : '+inf'} readOnly={true} className="readonlyTextBox"/>
    <button title="advance time just enough for the next timer to elapse" disabled={nextTimedTransition===undefined} onClick={() => {
      const now = performance.now();
      setTime(time => {
        if (time.kind === "paused") {
          return {kind: "paused", simtime: nextTimedTransition[0]};
        }
        else {
          return {kind: "realtime", scale: time.scale, since: {simtime: nextTimedTransition[0], wallclktime: now}};
        }
      });
    }}><SkipNextIcon fontSize="small"/></button>
  </div>;
}
