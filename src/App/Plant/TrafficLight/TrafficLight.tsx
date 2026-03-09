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
import { computeTopology } from "@/statecharts/detect_topology";
import { makeStatechartPlant, PlantRenderProps, StatechartPlantSpec } from "../Plant";
import { RT_Statechart } from "@/statecharts/runtime_types";
import { useAudioContext } from "@/hooks/useAudioContext";
import { memo, useEffect, useMemo } from "react";
import { objectsEqual } from "@/util/util";
import { dummyTracer } from "@/statecharts/tracer";

export const trafficLightConcreteSyntax = trafficLightJSON as ConcreteSyntax;

export const [trafficLightAbstractSyntax, trafficLightErrors] = parseStatechart(trafficLightConcreteSyntax, computeTopology(trafficLightConcreteSyntax));

if (trafficLightErrors.length > 0) {
  console.error({trafficLightErrors});
  // throw new Error("there were errors parsing traffic light plant model. see console.")
}

type TrafficLightState = {
  red: boolean,
  yellow: boolean,
  green: boolean,
  timerGreen: boolean,
  timerValue: number,
}

export const TrafficLight = memo(function TrafficLight({state: {red, yellow, green, timerGreen, timerValue}, speed, raiseUIEvent}: PlantRenderProps<TrafficLightState>) {
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
  for (const [color, gain] of [[red, 0.5], [yellow, 1], [green, 0.3]] as [boolean, number][]) {
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

  return <div style={{display: 'flex', flexDirection: 'column'}}>
    <style>{style}</style>
    <svg width={200} height='auto' viewBox="0 0 424 791">
      <image xlinkHref={imgBackground} width={424} height={791}/>

      <image className={red    ? "" : "hidden"} xlinkHref={imgRedOverlay}    width={424} height={791}/>
      <image className={yellow ? "" : "hidden"} xlinkHref={imgYellowOverlay} width={424} height={791}/>
      <image className={green  ? "" : "hidden"} xlinkHref={imgGreenOverlay}  width={424} height={791}/>

      {timerValue >= 0 && <>
        <rect x={300} y={676} width={108} height={84} fill="black" />
        <text x={400} y={750} className="timer" fontFamily="digital-font" fontSize={100} fill={timerColor} textAnchor="end">{timerValue}</text>
      </>}
    </svg>
    <button style={{flexGrow: 1}} onClick={() => raiseUIEvent({name: "policeInterrupt"})}>POLICE INTERRUPT</button>
  </div>;
}, (oldProps, newProps) => {
  return objectsEqual(oldProps, newProps);
});

const trafficLightPlantSpec: StatechartPlantSpec<TrafficLightState> = {
  ast: trafficLightAbstractSyntax,
  cleanupState: (state: RT_Statechart) => {
    const red = state.mode.has(trafficLightAbstractSyntax.label2State.get("red on")!.uid);
    const yellow = state.mode.has(trafficLightAbstractSyntax.label2State.get("yellow on")!.uid);
    const green = state.mode.has(trafficLightAbstractSyntax.label2State.get("green on")!.uid);
    const timerGreen = state.mode.has(trafficLightAbstractSyntax.label2State.get("timer green")!.uid);
    const timerValue = state.environment.get("t", {kind: "state", thing: trafficLightAbstractSyntax.root});
    return { red, yellow, green, timerGreen, timerValue };
  },
  render: TrafficLight,
  uiEvents: [
    {kind: "event", event: "policeInterrupt"},
  ],
  signals: [
    "red",
    "yellow",
    "green",
    "timerGreen",
  ],
}

export const trafficLightPlant = makeStatechartPlant(trafficLightPlantSpec);
