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
import { useAudioContext } from "./useAudioContext";

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
  speed: number,
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
const START_X0 = BUTTON_X0;
const START_Y0 = 234;
const STOP_X0 = BUTTON_X0;
const STOP_Y0 = 211;
const INCTIME_X0 = BUTTON_X0;
const INCTIME_Y0 = 188;
const DOOR_X0 = 26;
const DOOR_Y0 = 68;
const DOOR_WIDTH = 353;
const DOOR_HEIGHT = 217;

export function Magnetron({state: {timeDisplay, bell, magnetron}, speed, callbacks}: MicrowaveProps) {
  const [door, setDoor] = useState<DoorState>("closed");

  const [playSound, preloadAudio] = useAudioContext(speed);

  // preload(imgSmallClosedOff, {as: "image"});
  preload(imgSmallClosedOn, {as: "image"});
  preload(imgSmallOpenedOff, {as: "image"});
  preload(imgSmallOpenedOn, {as: "image"});

  preloadAudio(sndRunning);
  preloadAudio(sndBell);

  // a bit hacky: when the bell-state changes to true, we play the bell sound...
  useEffect(() => {
    if (bell) {
      playSound(sndBell, false);
    }
  }, [bell]);

  useEffect(() => {
    if (magnetron === "on") {
      const stopSoundRunning = playSound(sndRunning, true);
      return () => stopSoundRunning();
    }
    return () => {};
  }, [magnetron])


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
    <svg width='400px' height='auto' viewBox="0 0 520 348">
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
      <rect className="microwaveDoorHelper" x={DOOR_X0} y={DOOR_Y0} width={DOOR_WIDTH} height={DOOR_HEIGHT}         onMouseDown={() => door === "open" ? closeDoor() : openDoor()}
      />

      <text x={472} y={106} textAnchor="end" fontFamily="digital-font" fontSize={24} fill="lightgreen">{timeDisplay}</text>
    </svg>
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
  render: (state, raiseEvent, speed) => <Magnetron state={state} speed={speed} callbacks={{
    startPressed: () => raiseEvent({name: "startPressed"}),
    stopPressed: () => raiseEvent({name: "stopPressed"}),
    incTimePressed: () => raiseEvent({name: "incTimePressed"}),
    incTimeReleased: () => raiseEvent({name: "incTimeReleased"}),
    doorOpened: () => raiseEvent({name: "door", param: "open"}),
    doorClosed: () => raiseEvent({name: "door", param: "closed"}),
  }}/>,
}
