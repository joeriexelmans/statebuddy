import fontDigital from "../DigitalWatch/digital-font.ttf";
import imgBackground from "./background.webp";
import imgRedOverlay from "./red-overlay.webp";
import imgYellowOverlay from "./yellow-overlay.webp";
import imgGreenOverlay from "./green-overlay.webp";
import sndAtmosphere from "./atmosphere.opus";
import sndBuzz from "./buzz.wav";
import { preload } from "react-dom";

import trafficLightJSON from "./model.json";
import { parseStatechart } from "@/statecharts/parser";
import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { detectConnections } from "@/statecharts/detect_connections";
import { makeStatechartPlant, PlantRenderProps, StatechartPlantSpec } from "../Plant";
import { RT_Statechart } from "@/statecharts/runtime_types";
import { useAudioContext } from "@/hooks/useAudioContext";
import { memo, useEffect, useMemo } from "react";
import { objectsEqual } from "@/util/util";

export const trafficLightConcreteSyntax = trafficLightJSON as ConcreteSyntax;

export const [trafficLightAbstractSyntax, trafficLightErrors] = parseStatechart(trafficLightConcreteSyntax, detectConnections(trafficLightConcreteSyntax));

if (trafficLightErrors.length > 0) {
  console.error({trafficLightErrors});
  // throw new Error("there were errors parsing traffic light plant model. see console.")
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
    const snd = playURL(sndAtmosphere, true);
    return () => {
      snd.then(snd => snd.stop());
    };
  }, []);

  // for added realism, every light color has its own buzzing noise volume
  for (const [color, gain] of [[redOn, 0.5], [yellowOn, 1], [greenOn, 0.3]] as [boolean, number][]) {
    useEffect(() => {
      if (color) {
        const snd = playURL(sndBuzz, true, gain);
        return () => {
          snd.then(snd => snd.stop());
        };
      }
    }, [color]);
  };

  const timerColor = timerGreen ? "#59ae8b" : "#f9172e";

  const style = useMemo(() => `
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
      text-shadow: 0 0 5px ${timerColor}, 0 0 10px ${timerColor};
    }`,
    [timerColor, speed, fontDigital]);

  return <>
    <style>{style}</style>
    <svg width={200} height='auto' viewBox="0 0 424 791">
      <image xlinkHref={imgBackground} width={424} height={791}/>

      <image className={redOn    ? "" : "hidden"} xlinkHref={imgRedOverlay}    width={424} height={791}/>
      <image className={yellowOn ? "" : "hidden"} xlinkHref={imgYellowOverlay} width={424} height={791}/>
      <image className={greenOn  ? "" : "hidden"} xlinkHref={imgGreenOverlay}  width={424} height={791}/>

      {timerValue >= 0 && <>
        <rect x={300} y={676} width={108} height={84} fill="black" />
        <text x={400} y={750} className="timer" fontFamily="digital-font" fontSize={100} fill={timerColor} textAnchor="end">{timerValue}</text>
      </>}
    </svg>
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
    const timerValue = state.environment.get("t", {kind: "state", thing: trafficLightAbstractSyntax.root});
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
  ],
}

export const trafficLightPlant = makeStatechartPlant(trafficLightPlantSpec);
