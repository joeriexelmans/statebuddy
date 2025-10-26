import imgNote from "./noteSmall.png";
import imgWatch from "./watch.png";
import digitalFont from "./digital-font.ttf";
import { Plant } from "../Plant";
import { RaisedEvent } from "@/statecharts/runtime_types";

import sndBeep from "./beep.wav";
import "./DigitalWatch.css";
import { useAudioContext } from "@/App/useAudioContext";
import { useEffect } from "react";

type DigitalWatchState = {
  light: boolean;
  h: number;
  m: number;
  s: number;
  alarm: boolean;
  beep: boolean;
}

type DigitalWatchProps = {
  state: DigitalWatchState,
  speed: number
  callbacks: {
    onTopLeftPressed: () => void;
    onTopRightPressed: () => void;
    onBottomRightPressed: () => void;
    onBottomLeftPressed: () => void;
    onTopLeftReleased: () => void;
    onTopRightReleased: () => void;
    onBottomRightReleased: () => void;
    onBottomLeftReleased: () => void;
  },
}

export function DigitalWatch({state: {light, h, m, s, alarm, beep}, speed, callbacks}: DigitalWatchProps) {
  const twoDigits = (n: number) => n < 0 ? "  " : ("0"+n.toString()).slice(-2);
  const hhmmss = `${twoDigits(h)}:${twoDigits(m)}:${twoDigits(s)}`;

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

      {light &&
        <rect x={52} y={98} width={120} height={52} fill="#deeaffff" rx={5} ry={5} />}

      <text x="111" y="126" dominantBaseline="middle" textAnchor="middle" fontFamily="digital-font" fontSize={28} style={{whiteSpace:'preserve'}}>{hhmmss}</text>
    
      <rect className="watchButtonHelper" x={0} y={54} width={24} height={24} 
        onMouseDown={() => callbacks.onTopLeftPressed()}
        onMouseUp={() => callbacks.onTopLeftReleased()}
      />
      <rect className="watchButtonHelper" x={198} y={54} width={24} height={24}
        onMouseDown={() => callbacks.onTopRightPressed()}
        onMouseUp={() => callbacks.onTopRightReleased()}
      />
      <rect className="watchButtonHelper" x={0} y={154} width={24} height={24}
        onMouseDown={() => callbacks.onBottomLeftPressed()}
        onMouseUp={() => callbacks.onBottomLeftReleased()}
      />
      <rect className="watchButtonHelper" x={198} y={154} width={24} height={24}
        onMouseDown={() => callbacks.onBottomRightPressed()}
        onMouseUp={() => callbacks.onBottomRightReleased()}
      />

      {alarm &&
        <image x="54" y="98" xlinkHref={imgNote} />
      }
    </svg>
  </>;
}

export const DigitalWatchPlant: Plant<DigitalWatchState> = {
  inputEvents: [
    { kind: "event", event: "setH", paramName: 'h' },
    { kind: "event", event: "setM", paramName: 'm' },
    { kind: "event", event: "setS", paramName: 's' },
    { kind: "event", event: "setLight", paramName: 'lightOn'},
    { kind: "event", event: "setAlarm", paramName: 'alarmOn'},
    { kind: "event", event: "beep", paramName: 'beep'},
  ],
  outputEvents: [
    { kind: "event", event: "topLeftPressed" },
    { kind: "event", event: "topRightPressed" },
    { kind: "event", event: "bottomRightPressed" },
    { kind: "event", event: "bottomLeftPressed" },
    { kind: "event", event: "topLeftReleased" },
    { kind: "event", event: "topRightReleased" },
    { kind: "event", event: "bottomRightReleased" },
    { kind: "event", event: "bottomLeftReleased" },
  ],
  initial: {
    light: false,
    alarm: false,
    h: 12,
    m: 0,
    s: 0,
    beep: false,
  },
  reduce: (inputEvent: RaisedEvent, state: DigitalWatchState) => {
    if (inputEvent.name === "setH") {
      return { ...state, h: inputEvent.param };
    }
    if (inputEvent.name === "setM") {
      return { ...state, m: inputEvent.param };
    }
    if (inputEvent.name === "setS") {
      return { ...state, s: inputEvent.param };
    }
    if (inputEvent.name === "lightOn") {
      return { ...state, light: true };
    }
    if (inputEvent.name === "lightOff") {
      return { ...state, light: false };
    }
    if (inputEvent.name === "setAlarm") {
      return { ...state, alarm: true };
    }
    if (inputEvent.name === "unsetAlarm") {
      return { ...state, alarm: false };
    }
    if (inputEvent.name === "beep") {
      return { ...state, beep: inputEvent.param };
    }
    return state; // unknown event - ignore it
  },
  render: (state, raiseEvent, speed) => <DigitalWatch state={state} speed={speed} callbacks={{
    onTopLeftPressed: () => raiseEvent({name: "topLeftPressed"}),
    onTopRightPressed: () => raiseEvent({name: "topRightPressed"}),
    onBottomRightPressed: () => raiseEvent({name: "bottomRightPressed"}),
    onBottomLeftPressed: () => raiseEvent({name: "bottomLeftPressed"}),
    onTopLeftReleased: () => raiseEvent({name: "topLeftReleased"}),
    onTopRightReleased: () => raiseEvent({name: "topRightReleased"}),
    onBottomRightReleased: () => raiseEvent({name: "bottomRightReleased"}),
    onBottomLeftReleased: () => raiseEvent({name: "bottomLeftReleased"}),
  }}/>,
}
