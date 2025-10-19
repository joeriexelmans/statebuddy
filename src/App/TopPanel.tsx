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

import { formatTime } from "./util";
import { InsertMode } from "../VisualEditor/VisualEditor";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";

export type TopPanelProps = {
  rt?: BigStep,
  rtIdx?: number,
  time: TimeMode,
  setTime: Dispatch<SetStateAction<TimeMode>>,
  onInit: () => void,
  onClear: () => void,
  onRaise: (e: string, p: any) => void,
  onBack: () => void,
  ast: Statechart,
  mode: InsertMode,
  setMode: Dispatch<SetStateAction<InsertMode>>,
}

function RountangleIcon(props: {kind: string}) {
  return <svg width={20} height={20}>
    <rect rx={7} ry={7}
      x={1} y={1}
      width={18} height={18}
      className={`rountangle ${props.kind}`}
      style={{...(props.kind === "or" ? {strokeDasharray: '3 2'}: {}), strokeWidth: 1.2}}
    />
  </svg>;
}

function PseudoStateIcon(props: {}) {
  const w=20, h=20;
  return <svg width={w} height={h}>
    <polygon
      points={`
        ${w/2} ${1},
        ${w-1} ${h/2},
        ${w/2} ${h-1},
        ${1}   ${h/2},
      `} fill="white" stroke="black" strokeWidth={1.2}/>
  </svg>;
}

function HistoryIcon(props: {kind: "shallow"|"deep"}) {
  const w=20, h=20;
  const text = props.kind === "shallow" ? "H" : "H*";
  return <svg width={w} height={h}><circle cx={w/2} cy={h/2} r={Math.min(w,h)/2-1} fill="white" stroke="black"/><text x={w/2} y={h/2+4} textAnchor="middle" fontSize={11} fontWeight={400}>{text}</text></svg>;
}


export function TopPanel({rt, rtIdx, time, setTime, onInit, onClear, onRaise, onBack, ast, mode, setMode}: TopPanelProps) {
  const [displayTime, setDisplayTime] = useState("0.000");
  const [timescale, setTimescale] = useState(1);
  const [showKeys, setShowKeys] = useState(true);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        if (rt)
        onChangePaused(time.kind !== "paused", performance.now());
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
        e.preventDefault();
        onSkip();
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
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [time, onInit, timescale]);

  useEffect(() => {
    setTimeout(() => localStorage.setItem("showKeys", showKeys?"1":"0"), 100);
  }, [showKeys])

  useEffect(() => {
    const show = localStorage.getItem("showKeys") || "1";
    setShowKeys(show==="1")
  }, [])

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
    const now = performance.now();
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
    onTimeScaleChange((timescale/2).toString(), performance.now());
  }
  function onFaster() {
    onTimeScaleChange((timescale*2).toString(), performance.now());
  }

  return <>
    <div className="toolbar">

    <div style={{display:'inline-block'}}>

    <div style={{display:'inline-block'}}>
    <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Z</kbd></>}>
    <button title="undo"><UndoIcon fontSize="small"/></button>
    </KeyInfo>
    <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></>}>
    <button title="redo"><RedoIcon fontSize="small"/></button>
    </KeyInfo>
    </div>

    &emsp;

    <div style={{display:'inline-block'}}>
    {([
      ["and", "AND-states", <RountangleIcon kind="and"/>, <kbd>A</kbd>],
      ["or", "OR-states", <RountangleIcon kind="or"/>, <kbd>O</kbd>],
      ["pseudo", "pseudo-states", <PseudoStateIcon/>, <kbd>P</kbd>],
      ["shallow", "shallow history", <HistoryIcon kind="shallow"/>, <kbd>H</kbd>],
      ["deep", "deep history", <HistoryIcon kind="deep"/>, <></>],
      ["transition", "transitions", <TrendingFlatIcon fontSize="small"/>, <kbd>T</kbd>],
      ["text", "text", <>&nbsp;T&nbsp;</>, <kbd>X</kbd>],
    ] as [InsertMode, string, ReactElement, ReactElement][]).map(([m, hint, buttonTxt, keyInfo]) =>
      <KeyInfo keyInfo={keyInfo}>
      <button
        title={"insert "+hint}
        disabled={mode===m}
        className={mode===m ? "active":""}
        onClick={() => setMode(m)}
      >{buttonTxt}</button></KeyInfo>)}
    </div>

    &emsp;

    <div style={{display:'inline-block'}}>

    <KeyInfo keyInfo={<kbd>I</kbd>}>
    <button title="(re)initialize simulation" onClick={onInit} ><PlayArrowIcon fontSize="small"/><CachedIcon fontSize="small"/></button>
    </KeyInfo>
    <KeyInfo keyInfo={<kbd>C</kbd>}>
    <button title="clear the simulation" onClick={onClear} disabled={!rt}><StopIcon fontSize="small"/></button>
    </KeyInfo>

    &emsp;

    <KeyInfo keyInfo={<><kbd>Space</kbd> toggles</>}>
      <button title="pause the simulation" disabled={!rt || time.kind==="paused"} className={(rt && time.kind==="paused") ? "active":""} onClick={() => onChangePaused(true, performance.now())}><PauseIcon fontSize="small"/></button>
      <button title="run the simulation in real time" disabled={!rt || time.kind==="realtime"} className={(rt && time.kind==="realtime") ? "active":""} onClick={() => onChangePaused(false, performance.now())}><PlayArrowIcon fontSize="small"/></button>
    </KeyInfo>

    &emsp;

    <label htmlFor="number-timescale">speed</label>&nbsp;
    <KeyInfo keyInfo={<kbd>S</kbd>}>
    <button title="slower" onClick={onSlower}>÷2</button>
    </KeyInfo>
    <input title="controls how fast the simulation should run in real time mode - larger than 1 means: faster than wall-clock time" id="number-timescale" value={timescale.toFixed(3)} style={{width:40}} readOnly onChange={e => onTimeScaleChange(e.target.value, performance.now())}/>
    <KeyInfo keyInfo={<kbd>F</kbd>}>
    <button title="faster" onClick={onFaster}>×2</button>
    </KeyInfo>

    &emsp;

    <label htmlFor="time">time (s)</label>&nbsp;
    <input title="the current simulated time" id="time" disabled={!rt} value={displayTime} readOnly={true} className="readonlyTextBox" />


    &emsp;

    <KeyInfo>
    <label htmlFor="next-timeout">next (s)</label>&nbsp;
    <input title="next point in simulated time where a timed transition may fire" id="next-timeout" disabled={!rt} value={nextTimedTransition ? formatTime(nextTimedTransition[0]) : '+inf'} readOnly={true} className="readonlyTextBox"/>
    </KeyInfo>
    <KeyInfo keyInfo={<kbd>Tab</kbd>}>
    <button title="advance time just enough for the next timer to elapse" disabled={nextTimedTransition===undefined} onClick={onSkip}><SkipNextIcon fontSize="small"/><AccessAlarmIcon fontSize="small"/></button>
    </KeyInfo>

    &emsp; 
    <KeyInfo keyInfo={<kbd>Backspace</kbd>}>
      <button title="undo last step (go back in time)" 
      disabled={rtIdx===undefined || rtIdx===0} onClick={onBack}><SkipPreviousIcon fontSize="small"/></button>
    </KeyInfo>

    </div>

    &emsp;

    </div>
    <div style={{display:'inline-block'}}>

    {ast.inputEvents &&
      <>
        {ast.inputEvents.map(({event, paramName}) =>
        <><button title={`raise input event '${event}'`} disabled={!rt} onClick={() => {
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
        {paramName && <><input id={`input-${event}-param`} style={{width: 20}} placeholder={paramName}/></>}
        &nbsp;</>)}
      </>
    }

    &emsp;

    <div style={{display:"inline-block"}}>
    <KeyInfo keyInfo={<kbd>~</kbd>}>
    <input id="checkbox-keys" type="checkbox" checked={showKeys} onChange={e => setShowKeys(e.target.checked)}></input>
    <label for="checkbox-keys">see shortcuts</label>
    </KeyInfo>
    </div>

    </div>

  </div></>;
}
