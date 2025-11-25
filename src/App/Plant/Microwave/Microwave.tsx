import { preload } from "react-dom";
import imgSmallClosedOff from "./small_closed_off.webp";
import imgSmallClosedOn from "./small_closed_on.webp";
import imgSmallOpenedOff from "./small_opened_off.webp";
import imgSmallOpenedOn from "./small_opened_on.webp";

import fontDigital from "../DigitalWatch/digital-font.ttf";

import sndBell from "./bell.wav";
import sndRunning from "./running.wav";
import { RT_Statechart } from "@/statecharts/runtime_types";
import { memo, useEffect } from "react";

import "./Microwave.css";
import { useAudioContext } from "../../../hooks/useAudioContext";
import { makeStatechartPlant, PlantRenderProps, StatechartPlantSpec } from "../Plant";
import { detectConnections } from "@/statecharts/detect_connections";
import { parseStatechart } from "@/statecharts/parser";

import microwaveJSON from "./model.json";
import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { objectsEqual } from "@/util/util";

export const microwaveConcreteSyntax = microwaveJSON as ConcreteSyntax;

export const [microwaveAbstractSyntax, microwaveErrors] = parseStatechart(microwaveConcreteSyntax, detectConnections(microwaveConcreteSyntax));

if (microwaveErrors.length > 0) {
  console.error({microwaveErrors});
  // throw new Error("there were errors parsing microwave plant model. see console.")
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

type MicrowaveState = {
  bellRinging: boolean,
  magnetronRunning: boolean,
  doorOpen: boolean,
  timeDisplay: number,

  // these booleans are true for as long as the respective button is pressed (i.e., mouse button is down)
  startPressed: boolean,
  stopPressed: boolean,
  incTimePressed: boolean,
}

export const Microwave = memo(function Microwave({state: {bellRinging, magnetronRunning, doorOpen, timeDisplay}, speed, raiseUIEvent}: PlantRenderProps<MicrowaveState>) {
  const [playSound, preloadAudio] = useAudioContext(speed);

  // preload(imgSmallClosedOff, {as: "image"});
  preload(imgSmallClosedOn, {as: "image"});
  preload(imgSmallOpenedOff, {as: "image"});
  preload(imgSmallOpenedOn, {as: "image"});

  preloadAudio(sndRunning);
  preloadAudio(sndBell);

  // a bit hacky: when the bell-state changes to true, we play the bell sound...
  useEffect(() => {
    if (bellRinging) {
      playSound(sndBell, false);
    }
  }, [bellRinging]);

  useEffect(() => {
    if (magnetronRunning) {
      const snd = playSound(sndRunning, true);
      return () => snd.then(snd => snd.stop());
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
    <svg width='380px' height='auto' viewBox="0 0 520 348">
      {/* @ts-ignore */}
      <image xlinkHref={imgs[doorOpen][magnetronRunning]} width={520} height={348}/>

      <rect className="microwaveButtonHelper" x={START_X0} y={START_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseUIEvent({name: "startMouseDown"})}
        onMouseUp={() => raiseUIEvent({name: "startMouseUp"})}
      />
      <rect className="microwaveButtonHelper" x={STOP_X0} y={STOP_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseUIEvent({name: "stopMouseDown"})}
        onMouseUp={() => raiseUIEvent({name: "stopMouseUp"})}
      />
      <rect className="microwaveButtonHelper" x={INCTIME_X0} y={INCTIME_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseUIEvent({name: "incTimeMouseDown"})}
        onMouseUp={() => raiseUIEvent({name: "incTimeMouseUp"})}
      />
      <rect className="microwaveDoorHelper"
        x={DOOR_X0} y={DOOR_Y0} width={DOOR_WIDTH} height={DOOR_HEIGHT}
        onMouseDown={() => raiseUIEvent({name: "doorMouseDown"})}
        onMouseUp={() => raiseUIEvent({name: "doorMouseUp"})}
      />

      <text x={472} y={106} textAnchor="end" fontFamily="digital-font" fontSize={24} fill="lightgreen">{timeDisplay}</text>
    </svg>
  </>;
}, objectsEqual);

const microwavePlantSpec: StatechartPlantSpec<MicrowaveState> = {
  ast: microwaveAbstractSyntax,
  cleanupState: (state: RT_Statechart) => {
    const bellRinging = state.mode.has(microwaveAbstractSyntax.label2State.get("bell")!.uid);
    const magnetronRunning = state.mode.has(microwaveAbstractSyntax.label2State.get("Magnetron on")!.uid);
    const doorOpen = state.mode.has(microwaveAbstractSyntax.label2State.get("Door opened")!.uid);
    const startPressed = state.mode.has(microwaveAbstractSyntax.label2State.get("startPressed")!.uid);
    const stopPressed = state.mode.has(microwaveAbstractSyntax.label2State.get("stopPressed")!.uid);
    const incTimePressed = state.mode.has(microwaveAbstractSyntax.label2State.get("incTimePressed")!.uid);
    // let startPressed, stopPressed, incTimePressed;
    const timeDisplay = state.environment.get("timeDisplay");
    return {bellRinging, magnetronRunning, doorOpen, timeDisplay, startPressed, stopPressed, incTimePressed};
  },
  render: Microwave,
  uiEvents: [
    {kind: "event", event: "doorMouseDown"},
    {kind: "event", event: "doorMouseUp"},
    {kind: "event", event: "startMouseDown"},
    {kind: "event", event: "startMouseUp"},
    {kind: "event", event: "stopMouseDown"},
    {kind: "event", event: "stopMouseUp"},
    {kind: "event", event: "incTimeMouseDown"},
    {kind: "event", event: "incTimeMouseUp"},
  ],
  signals: [
    "bellRinging",
    "magnetronRunning",
    "doorOpen",

    // these booleans are true for as long as the respective button is pressed (i.e., mouse button is down)
    "startPressed",
    "stopPressed",
    "incTimePressed",
  ]
}

export const microwavePlant = makeStatechartPlant(microwavePlantSpec);
