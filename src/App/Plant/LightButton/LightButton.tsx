import { preload } from "react-dom";
import { memo, useEffect, useMemo } from "react";

import { useAudioContext } from "@/hooks/useAudioContext";
import { Plant, PlantRenderProps, StatechartPlantSpec } from "../Plant"

import imgLightsOff from "./lights-off.webp";
import imgLightsOn from "./lights-on.webp";

import imgSwitchDarkPressed from "./switch-dark-pressed.webp";
import imgSwitchDark from "./switch-dark.webp";
import imgSwitchLightPressed from "./switch-light-pressed.webp";
import imgSwitchLight from "./switch-light.webp";

import sndSwitch from "./switch.wav";
import sndBuzz from "../TrafficLight/buzz.wav";
import sndRelay from "./relay.wav";

import lightButtonJSON from "./model.json";

import { parseStatechart } from "@/statecharts/parser";
import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { computeTopology } from "@/statecharts/detect_topology";
import { makeStatechartPlant } from "../Plant";
import { RT_Statechart } from "@/statecharts/runtime_types";

export const lightButtonConcreteSyntax = lightButtonJSON as ConcreteSyntax;
export const [lightButtonAbstractSyntax, lightButtonErrors] = parseStatechart(computeTopology(lightButtonConcreteSyntax));

if (lightButtonErrors.length > 0) {
  console.error({lightButtonErrors});
  // throw new Error("there were errors parsing traffic light plant model. see console.")
}

type LightButtonState = {
  lightsOn: boolean,
};

export const LightButton = memo(function LightButton({state, speed, raiseUIEvent}: PlantRenderProps<LightButtonState>) {
  preload(imgLightsOff, {as: "image"});
  preload(imgLightsOn, {as: "image"});

  preload(imgSwitchDarkPressed, {as: "image"});
  preload(imgSwitchDark, {as: "image"});
  preload(imgSwitchLightPressed, {as: "image"});
  preload(imgSwitchLight, {as: "image"});

  const [playURL, preloadAudio] = useAudioContext(speed);

  // to keep things simple, the 'pressed' state of the button is not part of the plant state.
  // instead we just write a CSS rule that changes the image when the button is pressed (via the ':active' pseudo-class)
  const style = useMemo(() => `
    div.lightswitch {
      background-image: url(${state.lightsOn ? imgSwitchLight : imgSwitchDark});
      cursor: pointer;
      width: 160px;
      height: 148px;
    }
    div.lightswitch:active {
      background-image: url(${state.lightsOn ? imgSwitchLightPressed : imgSwitchDarkPressed});
    }
  `, [state.lightsOn]);

  // loop buzzing sound while the lights are on
  useEffect(() => {
    playURL(sndRelay, false);
    if (state.lightsOn) {
      const snd = playURL(sndBuzz, true);
      return () => {
        snd.then(snd => snd.stop());
      };
    }
  }, [state.lightsOn]);

  return <div>
    <img src={state.lightsOn ? imgLightsOn : imgLightsOff} style={{maxWidth: '100%'}} />
    <style>{style}</style>
    <div className="lightswitch"
      onMouseDown={() => {
        playURL(sndSwitch, false, 0.05);
        raiseUIEvent({name: "buttonPressed", param: true});
      }}
      onMouseUp={() => {
        playURL(sndSwitch, false, 0.02);
        raiseUIEvent({name: "buttonPressed", param: false});
      }}
    />
  </div>;
});

const lightButtonSpec: StatechartPlantSpec<LightButtonState> = {
  ast: lightButtonAbstractSyntax,
  render: LightButton,
  cleanupState: (state: RT_Statechart) => {
    const lightsOn = state.mode.has(lightButtonAbstractSyntax.label2State.get("LightsOn")!.uid);
    return {lightsOn};
  },
  uiEvents: [
    {kind: "event", event: "buttonPressed"},
  ],
  signals: [
    "lightsOn",
  ],
}

export const lightButtonPlant = makeStatechartPlant(lightButtonSpec);
