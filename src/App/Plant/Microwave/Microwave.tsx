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
import { computeTopology } from "@/statecharts/detect_topology";
import { parseStatechart } from "@/statecharts/parser";

import microwaveJSON from "./model.json";
import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { objectsEqual } from "@/util/util";
import { dummyTracer } from "@/statecharts/tracer";

export const microwaveConcreteSyntax = microwaveJSON as ConcreteSyntax;

export const [microwaveAbstractSyntax, microwaveErrors] = parseStatechart(microwaveConcreteSyntax, computeTopology(microwaveConcreteSyntax));

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
        onMouseDown={() => raiseUIEvent({name: "startButton", param: true})}
        onMouseUp={() => raiseUIEvent({name: "startButton", param: false})}
      />
      <rect className="microwaveButtonHelper" x={STOP_X0} y={STOP_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseUIEvent({name: "stopButton", param: true})}
        onMouseUp={() => raiseUIEvent({name: "stopButton", param: false})}
      />
      <rect className="microwaveButtonHelper" x={INCTIME_X0} y={INCTIME_Y0} width={BUTTON_WIDTH} height={BUTTON_HEIGHT} 
        onMouseDown={() => raiseUIEvent({name: "incTimeButton", param: true})}
        onMouseUp={() => raiseUIEvent({name: "incTimeButton", param: true})}
      />
      <rect className="microwaveDoorHelper"
        x={DOOR_X0} y={DOOR_Y0} width={DOOR_WIDTH} height={DOOR_HEIGHT}
        onMouseDown={() => raiseUIEvent({name: "doorMouseButton", param: true})}
        onMouseUp={() => raiseUIEvent({name: "doorMouseButton", param: false})}
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
    const timeDisplay = state.environment.get("timeDisplay", {kind: "state", thing: microwaveAbstractSyntax.root});
    return {bellRinging, magnetronRunning, doorOpen, timeDisplay};
  },
  render: Microwave,
  uiEvents: [
    {kind: "event", event: "startButton"},
    {kind: "event", event: "stopButton"},
    {kind: "event", event: "incTimeButton"},
    {kind: "event", event: "doorMouseButton"},
  ],
  signals: [
    "bellRinging",
    "magnetronRunning",
    "doorOpen",
  ]
}

export const microwavePlant = makeStatechartPlant(microwavePlantSpec);
