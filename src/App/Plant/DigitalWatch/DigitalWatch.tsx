import { useAudioContext } from "@/hooks/useAudioContext";
import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { detectConnections } from "@/statecharts/detect_connections";
import { parseStatechart } from "@/statecharts/parser";
import { RT_Statechart } from "@/statecharts/runtime_types";
import { memo, useEffect } from "react";
import { makeStatechartPlant, PlantRenderProps } from "../Plant";

import dwatchConcreteSyntax from "./model.json";
import sndBeep from "./beep.wav";
import digitalFont from "./digital-font.ttf";
import "./DigitalWatch.css";
import imgNote from "./noteSmall.png";
import imgWatch from "./watch.png";
import { objectsEqual } from "@/util/util";

export const [dwatchAbstractSyntax, dwatchErrors] = parseStatechart(dwatchConcreteSyntax as ConcreteSyntax, detectConnections(dwatchConcreteSyntax as ConcreteSyntax));

if (dwatchErrors.length > 0) {
  console.log({dwatchErrors});
  throw new Error("there were errors parsing dwatch plant model. see console.")
}

export type DigitalWatchPlantState = {
  lightOn: boolean,
  beep: boolean,
  alarmOn: boolean,
  displayingTime: boolean,
  displayingAlarm: boolean,
  displayingChrono: boolean,
  hideH: boolean,
  hideM: boolean,
  hideS: boolean,
  h: number,
  m: number,
  s: number,
  ah: number,
  am: number,
  as: number,
  cm: number,
  cs: number,
  chs: number,

  // these properties are true for as long as the mouse button is down:
  topLeftPressed: boolean,
  topRightPressed: boolean,
  bottomRightPressed: boolean,
  bottomLeftPressed: boolean,
}

function dwatchConfigToState(rtConfig: RT_Statechart): DigitalWatchPlantState {
  return {
    lightOn: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("lightOn")!.uid),
    beep: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("beep")!.uid),
    alarmOn: rtConfig.environment.get("alarm"),
    displayingTime: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("displayingTime")!.uid),
    displayingAlarm: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("displayingAlarm")!.uid),
    displayingChrono: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("displayingChrono")!.uid),
    hideH: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("hideH")!.uid),
    hideM: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("hideM")!.uid),
    hideS: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("hideS")!.uid),
    h: rtConfig.environment.get("h"),
    m: rtConfig.environment.get("m"),
    s: rtConfig.environment.get("s"),
    ah: rtConfig.environment.get("ah"),
    am: rtConfig.environment.get("am"),
    as: rtConfig.environment.get("as"),
    cm: rtConfig.environment.get("cm"),
    cs: rtConfig.environment.get("cs"),
    chs: rtConfig.environment.get("chs"),

    topLeftPressed: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("topLeftPressed")!.uid),
    topRightPressed: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("topRightPressed")!.uid),
    bottomRightPressed: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("bottomRightPressed")!.uid),
    bottomLeftPressed: rtConfig.mode.has(dwatchAbstractSyntax.label2State.get("bottomLeftPressed")!.uid),

  }
}


const twoDigits = (n: number) => ("0"+n.toString()).slice(-2);

export const DigitalWatch = memo(function DigitalWatch({state: {displayingTime, displayingAlarm, displayingChrono, lightOn, alarmOn, beep, h, m, s, ah, am, as, cm, cs, chs, hideH, hideM, hideS}, speed, raiseUIEvent}: PlantRenderProps<DigitalWatchPlantState>) {

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
    <svg version="1.1" width="222" height="236" style={{userSelect: 'none'}}>
      <image width="222" height="236" xlinkHref={imgWatch}/>

      {lightOn &&
        <rect x={52} y={98} width={120} height={52} fill="#deeaffff" rx={5} ry={5} />}

      <text x="111" y="126" dominantBaseline="middle" textAnchor="middle" fontFamily="digital-font" fontSize={28} style={{whiteSpace:'preserve'}}>{hhmmss}</text>
    
      <rect className="watchButtonHelper" x={0} y={54} width={24} height={24} 
        onMouseDown={() => raiseUIEvent({name: "topLeftMouseDown"})}
        onMouseUp={() => raiseUIEvent({name: "topLeftMouseUp"})}
      />
      <rect className="watchButtonHelper" x={198} y={54} width={24} height={24}
        onMouseDown={() => raiseUIEvent({name: "topRightMouseDown"})}
        onMouseUp={() => raiseUIEvent({name: "topRightMouseUp"})}
      />
      <rect className="watchButtonHelper" x={0} y={154} width={24} height={24}
        onMouseDown={() => raiseUIEvent({name: "bottomLeftMouseDown"})}
        onMouseUp={() => raiseUIEvent({name: "bottomLeftMouseUp"})}
      />
      <rect className="watchButtonHelper" x={198} y={154} width={24} height={24}
        onMouseDown={() => raiseUIEvent({name: "bottomRightMouseDown"})}
        onMouseUp={() => raiseUIEvent({name: "bottomRightMouseUp"})}
      />

      {alarmOn &&
        <image x="54" y="98" xlinkHref={imgNote} />
      }
    </svg>
  </>;
}, objectsEqual);

export const digitalWatchPlant = makeStatechartPlant({
  ast: dwatchAbstractSyntax,
  cleanupState: dwatchConfigToState,
  render: DigitalWatch,
  uiEvents: [
    { kind: "event", event: "topLeftMouseDown" },
    { kind: "event", event: "topRightMouseDown" },
    { kind: "event", event: "bottomRightMouseDown" },
    { kind: "event", event: "bottomLeftMouseDown" },
    { kind: "event", event: "topLeftMouseUp" },
    { kind: "event", event: "topRightMouseUp" },
    { kind: "event", event: "bottomRightMouseUp" },
    { kind: "event", event: "bottomLeftMouseUp" },
  ],
  signals: [
    "lightOn",
    "beep",
    "alarmOn",
    "displayingTime",
    "displayingAlarm",
    "displayingChrono",
    "hideH",
    "hideM",
    "hideS",

    // these properties are true for as long as the mouse button is down:
    "topLeftPressed",
    "topRightPressed",
    "bottomRightPressed",
    "bottomLeftPressed",
  ],
});
