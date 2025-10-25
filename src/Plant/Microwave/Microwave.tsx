import { preload } from "react-dom";
import imgSmallClosedOff from "./small_closed_off.png";
import imgSmallClosedOn from "./small_closed_on.png";
import imgSmallOpenedOff from "./small_opened_off.png";
import imgSmallOpenedOn from "./small_opened_off.png";

import fontDigital from "../DigitalWatch/digital-font.ttf";

import sndBell from "./bell.wav";
import sndRunning from "./running.wav";
import { Plant } from "../Plant";
import { RaisedEvent } from "@/statecharts/runtime_types";
import { useEffect, useState } from "react";

import "./Microwave.css";

export type MagnetronState = "on" | "off";
export type DoorState = "open" | "closed";

export function toggleDoor(d: DoorState) {
  if (d === "open") {
    return "closed";
  }
  else return "open";
}

export function toggleMagnetron(m: MagnetronState) {
  if (m === "on") {
    return "off";
  }
  return "on";
}

export type MicrowaveState = {
  // Note: the door state is not part of the MicrowaveState because it is not controlled by the statechart, but by the plant.
  timeDisplay: number,
  bell: boolean, // whether the bell should ring
  magnetron: MagnetronState,
}

export type MicrowaveProps = {
  state: MicrowaveState,
  callbacks: {
    startPressed: () => void;
    stopPressed: () => void;
    incTimePressed: () => void;
    incTimeReleased: () => void;
    doorOpened: () => void;
    doorClosed: () => void;
  }
}

const imgs = {
  closed: { off: imgSmallClosedOff, on: imgSmallClosedOn },
  open: { off: imgSmallOpenedOff, on: imgSmallOpenedOn },
}


const BUTTON_HEIGHT = 18;
const BUTTON_WIDTH = 60;

const BUTTON_X0 = 412;
const BUTTON_X1 = BUTTON_X0 + BUTTON_WIDTH;

const START_X0 = BUTTON_X0;
const START_Y0 = 234;
const START_X1 = BUTTON_X1;
const START_Y1 = START_Y0 + BUTTON_HEIGHT;

const STOP_X0 = BUTTON_X0;
const STOP_Y0 = 211;
const STOP_X1 = BUTTON_X1;
const STOP_Y1 = STOP_Y0 + BUTTON_HEIGHT;

const INCTIME_X0 = BUTTON_X0;
const INCTIME_Y0 = 188;
const INCTIME_X1 = BUTTON_X1;
const INCTIME_Y1 = INCTIME_Y0 + BUTTON_HEIGHT;

const DOOR_X0 = 26;
const DOOR_Y0 = 68;
const DOOR_WIDTH = 353;
const DOOR_HEIGHT = 217;


export function Magnetron({state: {timeDisplay, bell, magnetron}, callbacks}: MicrowaveProps) {
  const [door, setDoor] = useState<DoorState>("closed");
  const [playBell, setPlayBell] = useState(false);

  // a bit hacky: when the bell-state changes to true, we play the bell sound for 610 ms...
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (bell) {
      setPlayBell(true);
      timeout = setTimeout(() => {
        setPlayBell(false);
      }, 610);
    }
    return () => { if (timeout) clearTimeout(timeout); };
  }, [bell]);

  preload(imgSmallClosedOff, {as: "image"});
  preload(imgSmallClosedOn, {as: "image"});
  preload(imgSmallOpenedOff, {as: "image"});
  preload(imgSmallOpenedOn, {as: "image"});
  preload(sndBell, {as: "audio"});
  preload(sndRunning, {as: "audio"});

  const openDoor = () => {
    setDoor("open");
    callbacks.doorOpened();
  }
  const closeDoor = () => {
    setDoor("closed");
    callbacks.doorClosed();
  }

  return <>
    <style>{`
      @font-face{
        font-family: 'digital-font';
        src: url(${fontDigital});
      }
    `}</style>
    <svg width={520} height={348}>
      <image xlinkHref={imgs[door][magnetron]} width={520} height={348}/>

      <rect className="microwaveButtonHelper" x={START_X0} y={START_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => callbacks.startPressed()}
      />
      <rect className="microwaveButtonHelper" x={STOP_X0} y={STOP_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => callbacks.stopPressed()}
      />
      <rect className="microwaveButtonHelper" x={INCTIME_X0} y={INCTIME_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => callbacks.incTimePressed()}
        onMouseUp={() => callbacks.incTimeReleased()}
      />
      <rect className="microwaveButtonHelper" x={DOOR_X0} y={DOOR_Y0} width={DOOR_WIDTH} height={DOOR_HEIGHT} 
        onMouseDown={() => door === "open" ? closeDoor() : openDoor()}
      />

      <text x={472} y={106} textAnchor="end" fontFamily="digital-font" fontSize={24} fill="lightgreen">{timeDisplay}</text>
    </svg>

    {magnetron === "on" && <audio hidden autoPlay loop>
      <source src={sndRunning} type="audio/wav"/>
    </audio>}

    {playBell && <audio hidden autoPlay>
      <source src={sndBell} type="audio/wav"/>
    </audio>}
  </>;
}

export const MicrowavePlant: Plant<MicrowaveState> = {
  inputEvents: [],
  outputEvents: [],
  initial: {
    timeDisplay: 0,
    magnetron: "off",
    bell: false,
  },
  reduce: (inputEvent: RaisedEvent, state: MicrowaveState) => {
    if (inputEvent.name === "setMagnetron") {
      return { ...state, magnetron: inputEvent.param, bell: false };
    }
    if (inputEvent.name === "setTimeDisplay") {
      return { ...state, timeDisplay: inputEvent.param, bell: false };
    }
    if (inputEvent.name === "ringBell") {
      return { ...state, bell: true };
    }
    return state; // unknown event - ignore it
  },
  render: (state, raiseEvent) => <Magnetron state={state} callbacks={{
    startPressed: () => raiseEvent({name: "startPressed"}),
    stopPressed: () => raiseEvent({name: "stopPressed"}),
    incTimePressed: () => raiseEvent({name: "incTimePressed"}),
    incTimeReleased: () => raiseEvent({name: "incTimeReleased"}),
    doorOpened: () => raiseEvent({name: "door", param: "open"}),
    doorClosed: () => raiseEvent({name: "door", param: "closed"}),
  }}/>,
}
