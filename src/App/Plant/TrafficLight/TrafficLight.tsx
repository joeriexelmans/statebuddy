import fontDigital from "../DigitalWatch/digital-font.ttf";
import imgBackground from "./background.webp";
import imgRedOverlay from "./red-overlay.webp";
import imgYellowOverlay from "./yellow-overlay.webp";
import imgGreenOverlay from "./green-overlay.webp";
import sndAtmosphere from "./atmosphere.opus";
import sndBuzz from "./buzz.wav";
import { preload } from "react-dom";

import trafficLightConcreteSyntax from "./model.json";
import { parseStatechart } from "@/statecharts/parser";
import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { detectConnections } from "@/statecharts/detect_connections";
import { makeStatechartPlant, PlantRenderProps, StatechartPlantSpec } from "../Plant";
import { RT_Statechart } from "@/statecharts/runtime_types";
import { useAudioContext } from "@/hooks/useAudioContext";
import { memo, useEffect } from "react";
import { objectsEqual } from "@/util/util";

const [trafficLightAbstractSyntax, trafficLightErrors] = parseStatechart(trafficLightConcreteSyntax as ConcreteSyntax, detectConnections(trafficLightConcreteSyntax as ConcreteSyntax));

if (trafficLightErrors.length > 0) {
  console.log({trafficLightErrors});
  throw new Error("there were errors parsing traffic light plant model. see console.")
}

type TrafficLightState = {
  redOn: boolean,
  yellowOn: boolean,
  greenOn: boolean,
  timerGreen: boolean,
  timerValue: number,
}

export const TrafficLight = memo(function TrafficLight({state: {redOn, yellowOn, greenOn, timerGreen, timerValue}, speed, raiseUIEvent}: PlantRenderProps<TrafficLightState>) {
  // preload(imgBackground, {as: "image"});
  preload(imgRedOverlay, {as: "image"});
  preload(imgYellowOverlay, {as: "image"});
  preload(imgGreenOverlay, {as: "image"});
  
  const [playURL, preloadAudio] = useAudioContext(speed);

  // preloadAudio(sndAtmosphere);

  // play wind
  useEffect(() => {
    const stopPlaying = playURL(sndAtmosphere, true);
    return () => stopPlaying();
  }, []);

  // for added realism, every light color has its own buzzing noise volume
  for (const [color, gain] of [[redOn, 0.5], [yellowOn, 1], [greenOn, 0.3]] as [boolean, number][]) {
    useEffect(() => {
      if (color) {
        const stopPlaying = playURL(sndBuzz, true, gain);
        return () => {
          stopPlaying();
        };
      }
    }, [color]);
  }

  return <>
    <style>{`
      @font-face{
        font-family: 'digital-font';
        src: url(${fontDigital});
      }
      image {
        transition: opacity ${300/speed}ms ease;
      }
      .hidden {
        opacity: 0;
      }
      text.timer {
        text-shadow: 0 0 5px currentColor, 0 0 10px currentColor;
      }
    `}</style>
    <svg width={200} height='auto' viewBox="0 0 424 791">
      <image xlinkHref={imgBackground} width={424} height={791}/>

      <image className={redOn    ? "" : "hidden"} xlinkHref={imgRedOverlay}    width={424} height={791}/>
      <image className={yellowOn ? "" : "hidden"} xlinkHref={imgYellowOverlay} width={424} height={791}/>
      <image className={greenOn  ? "" : "hidden"} xlinkHref={imgGreenOverlay}  width={424} height={791}/>

      {timerValue >= 0 && <>
        <rect x={300} y={676} width={108} height={84} fill="black" />
        <text x={400} y={750} className="timer" fontFamily="digital-font" fontSize={100} fill={timerGreen ? "#59ae8b" : "#f9172e"} textAnchor="end">{timerValue}</text>
      </>}
    </svg>
    <br/>
    <button onClick={() => raiseUIEvent({name: "policeInterrupt"})}>POLICE INTERRUPT</button>
  </>;
}, (oldProps, newProps) => {
  return objectsEqual(oldProps, newProps);
});

const trafficLightPlantSpec: StatechartPlantSpec<TrafficLightState> = {
  ast: trafficLightAbstractSyntax,
  cleanupState: (state: RT_Statechart) => {
    const redOn = state.mode.has("85");
    const yellowOn = state.mode.has("87");
    const greenOn = state.mode.has("89");
    const timerGreen = state.mode.has("137");
    const timerValue = state.environment.get("t");
    return { redOn, yellowOn, greenOn, timerGreen, timerValue };
  },
  render: TrafficLight,
  uiEvents: [
    {kind: "event", event: "policeInterrupt"},
  ],
  signals: [
    "redOn",
    "yellowOn",
    "greenOn",
    "timerGreen",
    "timerValue",
  ],
}

export const trafficLightPlant = makeStatechartPlant(trafficLightPlantSpec);
