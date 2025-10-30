import { useAudioContext } from "@/App/useAudioContext";
import { ConcreteSyntax } from "@/App/VisualEditor/VisualEditor";
import { detectConnections } from "@/statecharts/detect_connections";
import { parseStatechart } from "@/statecharts/parser";
import { RT_Statechart } from "@/statecharts/runtime_types";
import { useEffect } from "react";
import { makeStatechartPlant, PlantRenderProps } from "../Plant";

import dwatchConcreteSyntax from "./model.json";
import sndBeep from "./beep.wav";
import digitalFont from "./digital-font.ttf";
import "./DigitalWatch.css";
import imgNote from "./noteSmall.png";
import imgWatch from "./watch.png";

export const [dwatchAbstractSyntax, dwatchErrors] = parseStatechart(dwatchConcreteSyntax as ConcreteSyntax, detectConnections(dwatchConcreteSyntax as ConcreteSyntax));

if (dwatchErrors.length > 0) {
  console.log({dwatchErrors});
  throw new Error("there were errors parsing dwatch plant model. see console.")
}


const twoDigits = (n: number) => ("0"+n.toString()).slice(-2);

export function DigitalWatch({state, speed, raiseUIEvent}: PlantRenderProps<RT_Statechart>) {
  const displayingTime = state.mode.has("625");
  const displayingAlarm = state.mode.has("626");
  const displayingChrono = state.mode.has("624");

  const lightOn = state.mode.has("630");

  const alarm = state.environment.get("alarm");

  const h = state.environment.get("h");
  const m = state.environment.get("m");
  const s = state.environment.get("s");
  const ah = state.environment.get("ah");
  const am = state.environment.get("am");
  const as = state.environment.get("as");
  const cm = state.environment.get("cm");
  const cs = state.environment.get("cs");
  const chs = state.environment.get("chs");

  const hideH = state.mode.has("628");
  const hideM = state.mode.has("633");
  const hideS = state.mode.has("627");

  // console.log({cm,cs,chs});

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

  const beep = state.mode.has("632");

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
        onMouseDown={() => raiseUIEvent({name: "topLeftPressed"})}
        onMouseUp={() => raiseUIEvent({name: "topLeftReleased"})}
      />
      <rect className="watchButtonHelper" x={198} y={54} width={24} height={24}
        onMouseDown={() => raiseUIEvent({name: "topRightPressed"})}
        onMouseUp={() => raiseUIEvent({name: "topRightReleased"})}
      />
      <rect className="watchButtonHelper" x={0} y={154} width={24} height={24}
        onMouseDown={() => raiseUIEvent({name: "bottomLeftPressed"})}
        onMouseUp={() => raiseUIEvent({name: "bottomLeftReleased"})}
      />
      <rect className="watchButtonHelper" x={198} y={154} width={24} height={24}
        onMouseDown={() => raiseUIEvent({name: "bottomRightPressed"})}
        onMouseUp={() => raiseUIEvent({name: "bottomRightReleased"})}
      />

      {alarm &&
        <image x="54" y="98" xlinkHref={imgNote} />
      }
    </svg>
  </>;
}

export const digitalWatchPlant = makeStatechartPlant({
  ast: dwatchAbstractSyntax,
  render: DigitalWatch,
  uiEvents: [
    { kind: "event", event: "topLeftPressed" },
    { kind: "event", event: "topRightPressed" },
    { kind: "event", event: "bottomRightPressed" },
    { kind: "event", event: "bottomLeftPressed" },
    { kind: "event", event: "topLeftReleased" },
    { kind: "event", event: "topRightReleased" },
    { kind: "event", event: "bottomRightReleased" },
    { kind: "event", event: "bottomLeftReleased" },
  ],
});
