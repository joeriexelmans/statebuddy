import { preload } from "react-dom";
import imgSmallClosedOff from "./small_closed_off.png";
import imgSmallClosedOn from "./small_closed_on.png";
import imgSmallOpenedOff from "./small_opened_off.png";
import imgSmallOpenedOn from "./small_opened_on.png";

import fontDigital from "../DigitalWatch/digital-font.ttf";

import sndBell from "./bell.wav";
import sndRunning from "./running.wav";
import { BigStep, RaisedEvent, RT_Statechart } from "@/statecharts/runtime_types";
import { useEffect } from "react";

import "./Microwave.css";
import { useAudioContext } from "../../useAudioContext";
import { Plant, PlantRenderProps } from "../Plant";
import { statechartExecution } from "@/statecharts/timed_reactive";
import { microwaveAbstractSyntax } from "./model";


const imgs = {
  "false": { "false": imgSmallClosedOff, "true": imgSmallClosedOn },
  "true": { "false": imgSmallOpenedOff, "true": imgSmallOpenedOn },
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

export function Microwave({state, speed, raiseInput}: PlantRenderProps<RT_Statechart>) {
  const [playSound, preloadAudio] = useAudioContext(speed);

  // preload(imgSmallClosedOff, {as: "image"});
  preload(imgSmallClosedOn, {as: "image"});
  preload(imgSmallOpenedOff, {as: "image"});
  preload(imgSmallOpenedOn, {as: "image"});

  preloadAudio(sndRunning);
  preloadAudio(sndBell);

  const bellRinging = state.mode.has("45");
  const magnetronRunning = state.mode.has("28");
  const doorOpen = state.mode.has("13");
  const timeDisplay = state.environment.get("timeDisplay");

  // a bit hacky: when the bell-state changes to true, we play the bell sound...
  useEffect(() => {
    if (bellRinging) {
      playSound(sndBell, false);
    }
  }, [bellRinging]);

  useEffect(() => {
    if (magnetronRunning) {
      const stopSoundRunning = playSound(sndRunning, true);
      return () => stopSoundRunning();
    }
    return () => {};
  }, [magnetronRunning])

  return <>
    <style>{`
      @font-face{
        font-family: 'digital-font';
        src: url(${fontDigital});
      }
    `}</style>
    <svg width='400px' height='auto' viewBox="0 0 520 348">
      {/* @ts-ignore */}
      <image xlinkHref={imgs[doorOpen][magnetronRunning]} width={520} height={348}/>

      <rect className="microwaveButtonHelper" x={START_X0} y={START_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseInput({name: "startPressed"})}
        onMouseUp={() => raiseInput({name: "startReleased"})}
      />
      <rect className="microwaveButtonHelper" x={STOP_X0} y={STOP_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseInput({name: "stopPressed"})}
        onMouseUp={() => raiseInput({name: "stopReleased"})}
      />
      <rect className="microwaveButtonHelper" x={INCTIME_X0} y={INCTIME_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseInput({name: "incTimePressed"})}
        onMouseUp={() => raiseInput({name: "incTimeReleased"})}
      />
      <rect className="microwaveDoorHelper"
        x={DOOR_X0} y={DOOR_Y0} width={DOOR_WIDTH} height={DOOR_HEIGHT}
        onMouseDown={() => raiseInput({name: "doorMouseDown"})}
        onMouseUp={() => raiseInput({name: "doorMouseUp"})}
      />
      <text x={472} y={106} textAnchor="end" fontFamily="digital-font" fontSize={24} fill="lightgreen">{timeDisplay}</text>
    </svg>
  </>;
}

export const MicrowavePlant: Plant<BigStep> = {
  inputEvents: [
    // events coming from statechart    
    {kind: "event", event: "setTimeDisplay", paramName: "t"},
    {kind: "event", event: "setMagnetron", paramName: "state"},
    {kind: "event", event: "ringBell"},

    // events coming from UI:
    {kind: "event", event: "doorMouseDown"},
    {kind: "event", event: "doorMouseUp"},
    {kind: "event", event: "startPressed"},
    {kind: "event", event: "stopPressed"},
    {kind: "event", event: "incTimePressed"},
    {kind: "event", event: "startReleased"},
    {kind: "event", event: "stopReleased"},
    {kind: "event", event: "incTimeReleased"},
  ],
  outputEvents: [
    {kind: "event", event: "door", paramName: "state"},
    {kind: "event", event: "startPressed"},
    {kind: "event", event: "stopPressed"},
    {kind: "event", event: "incTimePressed"},
    {kind: "event", event: "startReleased"},
    {kind: "event", event: "stopReleased"},
    {kind: "event", event: "incTimeReleased"},
  ],
  execution: statechartExecution(microwaveAbstractSyntax),
  render: Microwave,
}
