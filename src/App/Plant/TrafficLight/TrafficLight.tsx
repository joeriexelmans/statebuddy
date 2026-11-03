import fontDigital from "../DigitalWatch/digital-font.ttf";
import imgBackground from "./background.webp";
import imgRedOverlay from "./red-overlay.webp";
import imgYellowOverlay from "./yellow-overlay.webp";
import imgGreenOverlay from "./green-overlay.webp";
import sndAtmosphere from "./atmosphere.opus";
import sndBuzz from "./buzz.wav";
import { preload } from "react-dom";

import trafficLightJSON from "./model.json";
import { parseStatechart } from "@/languages/statecharts/parser/parser";
import { ConcreteSyntax } from "@/languages/statecharts/concrete_syntax";
import { computeTopology } from "@/languages/statecharts/parser/detect_topology";
import { makeStatechartPlant, PlantRenderProps, StatechartPlantSpec } from "../Plant";
import { useAudioContext } from "@/hooks/useAudioContext";
import { memo, useEffect, useMemo } from "react";
import { objectsEqual } from "@/util/util";
import { SC2DEVSNonError } from "@/languages/devs/sc2devs";

export const trafficLightConcreteSyntax = trafficLightJSON as ConcreteSyntax;

export const [trafficLightAbstractSyntax, trafficLightErrors] = parseStatechart(computeTopology(trafficLightConcreteSyntax));

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
    text.timer.red {
      fill: #f9172e;
      text-shadow: 0 0 5px #f9172e, 0 0 10px #f9172e;
    }
    text.timer.green {
      fill: #59ae8b;
      text-shadow: 0 0 5px #59ae8b, 0 0 10px #59ae8b;
    }`,
    [speed, fontDigital]);

  return <div style={{display: 'flex', flexDirection: 'column'}}>
    <style>{style}</style>
    <svg width={200} height='auto' viewBox="0 0 424 791">
      <image xlinkHref={imgBackground} width={424} height={791}/>

      <image className={red    ? "" : "hidden"} xlinkHref={imgRedOverlay}    width={424} height={791}/>
      <image className={yellow ? "" : "hidden"} xlinkHref={imgYellowOverlay} width={424} height={791}/>
      <image className={green  ? "" : "hidden"} xlinkHref={imgGreenOverlay}  width={424} height={791}/>

      {timerValue >= 0 && <>
        <rect x={300} y={676} width={108} height={84} fill="black" />
        <text x={400} y={750} className={"timer " + (timerGreen ? "green" : "red")} fontFamily="digital-font" fontSize={100} textAnchor="end">{timerValue}</text>
      </>}
    </svg>
    <button style={{flexGrow: 1}} onClick={() => raiseUIEvent({name: "policeInterrupt"})}>POLICE INTERRUPT</button>
  </div>;
}, (oldProps, newProps) => {
  return objectsEqual(oldProps, newProps);
});

const trafficLightPlantSpec: StatechartPlantSpec<TrafficLightState> = {
  ast: trafficLightAbstractSyntax,
  cleanupState: (state: SC2DEVSNonError) => {
    const red = state.rtconfig.mode.has(trafficLightAbstractSyntax.tag2State.get("#redOn")!.uid);
    const yellow = state.rtconfig.mode.has(trafficLightAbstractSyntax.tag2State.get("#yellowOn")!.uid);
    const green = state.rtconfig.mode.has(trafficLightAbstractSyntax.tag2State.get("#greenOn")!.uid);
    const timerGreen = state.rtconfig.mode.has(trafficLightAbstractSyntax.tag2State.get("#timerGreen")!.uid);
    const timerValue = state.rtconfig.environment.get("t", {kind: "state", thing: trafficLightAbstractSyntax.root});
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
