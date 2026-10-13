import { useAudioContext } from "@/hooks/useAudioContext";
import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { computeTopology } from "@/statecharts/detect_topology";
import { parseStatechart } from "@/statecharts/parser";
import { RuntimeConfiguration } from "@/statecharts/runtime_types";
import { memo, useEffect } from "react";
import { makeStatechartPlant, PlantRenderProps } from "../Plant";

import dwatchJSON from "./model.json";
import sndBeep from "./beep.wav";
import digitalFont from "./digital-font.ttf";
import "./DigitalWatch.css";
import imgNote from "./noteSmall.png";
import imgWatch from "./watch.webp";
import { jsonDeepEqual } from "@/util/util";
import { Scope } from "@/statecharts/environment";
import { SC2DEVSNonError } from "@/devs/sc2devs";

export const dwatchConcreteSyntax = dwatchJSON as ConcreteSyntax;

export const [dwatchAbstractSyntax, dwatchErrors] = parseStatechart(computeTopology(dwatchConcreteSyntax));


if (dwatchErrors.length > 0) {
  console.error({dwatchErrors});
  // throw new Error("there were errors parsing dwatch plant model. see console.")
}

export type DigitalWatchPlantState = {
  // from environment (variables)
  alarmEnabled: boolean,
  h: number,
  m: number,
  s: number,
  ah: number,
  am: number,
  as: number,
  cm: number,
  cs: number,
  chs: number,

  // from modal state
  light: boolean,
  beep: boolean,
  displayingTime: boolean,
  displayingAlarm: boolean,
  displayingChrono: boolean,
  editing: boolean,
  hideH: boolean,
  hideM: boolean,
  hideS: boolean,
}

const rootScope: Scope = {kind: "state", thing: dwatchAbstractSyntax.root};

function dwatchConfigToState({rtconfig}: SC2DEVSNonError): DigitalWatchPlantState {
  return {
    alarmEnabled: rtconfig.environment.get("alarmEnabled", rootScope),
    h: rtconfig.environment.get("h", rootScope),
    m: rtconfig.environment.get("m", rootScope),
    s: rtconfig.environment.get("s", rootScope),
    ah: rtconfig.environment.get("ah", rootScope),
    am: rtconfig.environment.get("am", rootScope),
    as: rtconfig.environment.get("as", rootScope),
    cm: rtconfig.environment.get("cm", rootScope),
    cs: rtconfig.environment.get("cs", rootScope),
    chs: rtconfig.environment.get("chs", rootScope),

    light: rtconfig.mode.has(dwatchAbstractSyntax.label2State.get("lightOn")!.uid),
    beep: rtconfig.mode.has(dwatchAbstractSyntax.label2State.get("beep")!.uid),
    displayingTime: rtconfig.mode.has(dwatchAbstractSyntax.label2State.get("displayingTime")!.uid),
    displayingAlarm: rtconfig.mode.has(dwatchAbstractSyntax.label2State.get("displayingAlarm")!.uid),
    displayingChrono: rtconfig.mode.has(dwatchAbstractSyntax.label2State.get("displayingChrono")!.uid),
    editing: rtconfig.mode.has(dwatchAbstractSyntax.label2State.get("editing")!.uid),
    hideH: rtconfig.mode.has(dwatchAbstractSyntax.label2State.get("hideH")!.uid),
    hideM: rtconfig.mode.has(dwatchAbstractSyntax.label2State.get("hideM")!.uid),
    hideS: rtconfig.mode.has(dwatchAbstractSyntax.label2State.get("hideS")!.uid),
  }
}


const twoDigits = (n: number) => ("0"+n.toString()).slice(-2);

export const DigitalWatch = memo(function DigitalWatch({state: {displayingTime, displayingAlarm, displayingChrono, light, alarmEnabled, beep, h, m, s, ah, am, as, cm, cs, chs, hideH, hideM, hideS}, speed, raiseUIEvent}: PlantRenderProps<DigitalWatchPlantState>) {

  let hhmmss;
  if (displayingTime) {
    hhmmss = `${hideH ? "  " : twoDigits(h)}:${hideM ? "  " : twoDigits(m)}:${hideS ? "  " : twoDigits(s)}`;
  }
  else if (displayingAlarm) {
    hhmmss = `${hideH ? "  " : twoDigits(ah)}:${hideM ? "  " : twoDigits(am)}:${hideS ? "  " : twoDigits(as)}`;
  }
  else if (displayingChrono) {
    hhmmss = `${hideH ? "  " : twoDigits(cm)}:${hideM ? "  " : twoDigits(cs)}:${hideS ? "  " : twoDigits(chs)}`;
  }

  const [playSound, preloadAudio] = useAudioContext(speed);

  preloadAudio(sndBeep);

  useEffect(() => {
    if (beep) {
      playSound(sndBeep, false);
    }
  }, [beep])

  return <>
    <style>{`
      @font-face{
        font-family: 'digital-font';
        src: url(${digitalFont});
      }
    `}</style>
    <svg width="222" height="236" style={{userSelect: 'none'}}>
      <image width="222" height="236" xlinkHref={imgWatch}/>

      {light &&
        <rect x={52} y={98} width={120} height={52} fill="#deeaffff" rx={5} ry={5} />}

      <text x="111" y="126" dominantBaseline="middle" textAnchor="middle" fontFamily="digital-font" fontSize={28} style={{whiteSpace:'preserve'}}>{hhmmss}</text>
    
      <rect className="watchButtonHelper" x={0} y={54} width={24} height={24} 
        onMouseDown={() => raiseUIEvent({name: "topLeft", param: true})}
        onMouseUp={() => raiseUIEvent({name: "topLeft", param: false})}
      />
      <rect className="watchButtonHelper" x={198} y={54} width={24} height={24}
        onMouseDown={() => raiseUIEvent({name: "topRight", param: true})}
        onMouseUp={() => raiseUIEvent({name: "topRight", param: false})}
      />
      <rect className="watchButtonHelper" x={0} y={154} width={24} height={24}
        onMouseDown={() => raiseUIEvent({name: "bottomLeft", param: true})}
        onMouseUp={() => raiseUIEvent({name: "bottomLeft", param: false})}
      />
      <rect className="watchButtonHelper" x={198} y={154} width={24} height={24}
        onMouseDown={() => raiseUIEvent({name: "bottomRight", param: true})}
        onMouseUp={() => raiseUIEvent({name: "bottomRight", param: false})}
      />

      {alarmEnabled &&
        <image x="54" y="98" xlinkHref={imgNote} />
      }
    </svg>
  </>;
}, jsonDeepEqual);

export const digitalWatchPlant = makeStatechartPlant({
  ast: dwatchAbstractSyntax,
  cleanupState: dwatchConfigToState,
  render: DigitalWatch,
  uiEvents: [
    { kind: "event", event: "topLeft" },
    { kind: "event", event: "topRight" },
    { kind: "event", event: "bottomRight" },
    { kind: "event", event: "bottomLeft" },
  ],
  signals: [
    "light",
    "beep",
    "alarmEnabled",
    "displayingTime",
    "displayingAlarm",
    "displayingChrono",
    "editing",
    "hideH",
    "hideM",
    "hideS",
  ],
});
