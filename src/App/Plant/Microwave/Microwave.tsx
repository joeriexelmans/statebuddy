import { preload } from "react-dom";
import imgSmallClosedOff from "./small_closed_off.png";
import imgSmallClosedOn from "./small_closed_on.png";
import imgSmallOpenedOff from "./small_opened_off.png";
import imgSmallOpenedOn from "./small_opened_on.png";

import fontDigital from "../DigitalWatch/digital-font.ttf";

import sndBell from "./bell.wav";
import sndRunning from "./running.wav";
import { RT_Statechart } from "@/statecharts/runtime_types";
import { memo, useEffect } from "react";

import "./Microwave.css";
import { useAudioContext } from "../../useAudioContext";
import { comparePlantRenderProps, makeStatechartPlant, PlantRenderProps, StatechartPlantSpec } from "../Plant";
import { detectConnections } from "@/statecharts/detect_connections";
import { parseStatechart } from "@/statecharts/parser";

import microwaveConcreteSyntax from "./model.json";
import { ConcreteSyntax } from "@/App/VisualEditor/VisualEditor";

export const [microwaveAbstractSyntax, microwaveErrors] = parseStatechart(microwaveConcreteSyntax as ConcreteSyntax, detectConnections(microwaveConcreteSyntax as ConcreteSyntax));

if (microwaveErrors.length > 0) {
  console.log({microwaveErrors});
  throw new Error("there were errors parsing microwave plant model. see console.")
}


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

export const Microwave = memo(function Microwave({state, speed, raiseUIEvent}: PlantRenderProps<RT_Statechart>) {
  const [playSound, preloadAudio] = useAudioContext(speed);

  // preload(imgSmallClosedOff, {as: "image"});
  preload(imgSmallClosedOn, {as: "image"});
  preload(imgSmallOpenedOff, {as: "image"});
  preload(imgSmallOpenedOn, {as: "image"});

  preloadAudio(sndRunning);
  preloadAudio(sndBell);

  const bellRinging = state.mode.has("12");
  const magnetronRunning = state.mode.has("8");
  const doorOpen = state.mode.has("7");
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
        onMouseDown={() => raiseUIEvent({name: "startPressed"})}
        onMouseUp={() => raiseUIEvent({name: "startReleased"})}
      />
      <rect className="microwaveButtonHelper" x={STOP_X0} y={STOP_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseUIEvent({name: "stopPressed"})}
        onMouseUp={() => raiseUIEvent({name: "stopReleased"})}
      />
      <rect className="microwaveButtonHelper" x={INCTIME_X0} y={INCTIME_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseUIEvent({name: "incTimePressed"})}
        onMouseUp={() => raiseUIEvent({name: "incTimeReleased"})}
      />
      <rect className="microwaveDoorHelper"
        x={DOOR_X0} y={DOOR_Y0} width={DOOR_WIDTH} height={DOOR_HEIGHT}
        onMouseDown={() => raiseUIEvent({name: "doorMouseDown"})}
        onMouseUp={() => raiseUIEvent({name: "doorMouseUp"})}
      />

      <text x={472} y={106} textAnchor="end" fontFamily="digital-font" fontSize={24} fill="lightgreen">{timeDisplay}</text>
    </svg>
  </>;
}, comparePlantRenderProps);

const microwavePlantSpec: StatechartPlantSpec = {
  ast: microwaveAbstractSyntax,
  render: Microwave,
  uiEvents: [
    {kind: "event", event: "doorMouseDown"},
    {kind: "event", event: "doorMouseUp"},
    {kind: "event", event: "startPressed"},
    {kind: "event", event: "startReleased"},
    {kind: "event", event: "stopPressed"},
    {kind: "event", event: "stopReleased"},
    {kind: "event", event: "incTimePressed"},
    {kind: "event", event: "incTimeReleased"},
  ],
}

export const microwavePlant = makeStatechartPlant(microwavePlantSpec);
