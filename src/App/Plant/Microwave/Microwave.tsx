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

const ctx = new AudioContext();

function fetchAudioBuffer(url: string): Promise<AudioBuffer> {
  return fetch(url).then(res => {
    return res.arrayBuffer();
  }).then(buf => {
    return ctx.decodeAudioData(buf);
  });
}

// Using the Web Audio API was the only way I could get the 'microwave running' sound to properly play gapless in Chrome.
function playAudioBufer(buf: AudioBuffer, loop: boolean, speed: number): AudioCallbacks {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  
  const lowPass = ctx.createBiquadFilter();
  lowPass.type = 'highpass';
  lowPass.frequency.value = 20; // let's not blow up anyone's speakers
  
  src.connect(lowPass);
  lowPass.connect(ctx.destination);
  
  if (loop) src.loop = true;
  src.start();
  return [
    () => src.stop(),
    (speed: number) => {
      // instead of setting playback rate to 0 (which browsers seem to handle as if playback rate was set to 1, we just set it to a very small value, making it "almost paused")
      // combined with the lowpass filter above, this should produce any audible results.
      src.playbackRate.value = (speed===0) ? 0.00001 : speed;
      return;
    },
  ];
}

type AudioCallbacks = [
  () => void,
  (speed: number) => void,
];

export function Magnetron({state: {timeDisplay, bell, magnetron}, speed, callbacks}: MicrowaveProps) {
  const [door, setDoor] = useState<DoorState>("closed");

  const [soundsPlaying, setSoundsPlaying] = useState<AudioCallbacks[]>([]);
  const [bufRunningPromise] = useState(() => fetchAudioBuffer(sndRunning));
  const [bufBellPromise] = useState(() => fetchAudioBuffer(sndBell));

  // a bit hacky: when the bell-state changes to true, we play the bell sound...
  useEffect(() => {
    if (bell) {
      bufBellPromise.then(buf => {
        const cbs = playAudioBufer(buf, false, speed);
        setSoundsPlaying(sounds => [...sounds, cbs]);
      });
    }
  }, [bell]);

  useEffect(() => {
    if (magnetron === "on") {
      const stop = bufRunningPromise.then(buf => {
        const cbs = playAudioBufer(buf, true, speed);
        setSoundsPlaying(sounds => [...sounds, cbs]);
        return () => {
          cbs[0]();
          setSoundsPlaying(sounds => sounds.filter(cbs_ => cbs_ !== cbs));
        }
      });
      return () => stop.then(stop => {
        stop();
      });
    }
    return () => {};
  }, [magnetron])

  useEffect(() => {
    soundsPlaying.forEach(([_, setSpeed]) => setSpeed(speed));
  }, [soundsPlaying, speed])

  // preload(imgSmallClosedOff, {as: "image"});
  preload(imgSmallClosedOn, {as: "image"});
  preload(imgSmallOpenedOff, {as: "image"});
  preload(imgSmallOpenedOn, {as: "image"});

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
