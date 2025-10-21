import { useRef } from "react";

import imgNote from "./noteSmall.png";
import imgWatch from "./watch.png";
import imgWatchLight from "./watch-light.png";
import digitalFont from "./digital-font.ttf";
import { Plant } from "../Plant";
import { RaisedEvent } from "@/statecharts/runtime_types";

type DigitalWatchState = {
  light: boolean;
  h: number;
  m: number;
  s: number;
  alarm: boolean;
}

type DigitalWatchProps = DigitalWatchState & {
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

export function DigitalWatch({light, h, m, s, alarm, callbacks}: DigitalWatchProps) {
  console.log(light, h, m);
  const twoDigits = (n: number) => ("0"+n.toString()).slice(-2);
  const hhmmss = `${twoDigits(h)}:${twoDigits(m)}:${twoDigits(s)}`;

  return <>
    <style>{`
      @font-face{
        font-family: 'digital-font';
        src: url(${digitalFont});
      }
    `}</style>
    <svg version="1.1" width="222" height="236" style={{userSelect: 'none'}}>
      {light ?
        <image width="222" height="236" xlinkHref={imgWatchLight}/>
      : <image width="222" height="236" xlinkHref={imgWatch}/>
      }

      <text x="111" y="126" dominant-baseline="middle" text-anchor="middle" fontFamily="digital-font" fontSize={28}>{hhmmss}</text>
    
      <rect x="0" y="59" width="16" height="16" fill="#fff" fill-opacity="0" 
        onMouseDown={() => callbacks.onTopLeftPressed()}
        onMouseUp={() => callbacks.onTopLeftReleased()}
      />
      <rect x="206" y="57" width="16" height="16" fill="#fff" fill-opacity="0"
        onMouseDown={() => callbacks.onTopRightPressed()}
        onMouseUp={() => callbacks.onTopRightReleased()}
      />
      <rect x="0" y="158" width="16" height="16" fill="#fff" fill-opacity="0"
        onMouseDown={() => callbacks.onBottomLeftPressed()}
        onMouseUp={() => callbacks.onBottomLeftReleased()}
      />
      <rect x="208" y="158" width="16" height="16" fill="#fff" fill-opacity="0"
        onMouseDown={() => callbacks.onBottomRightPressed()}
        onMouseUp={() => callbacks.onBottomRightReleased()}
      />

      {alarm &&
        <image x="54" y="98" xlinkHref={imgNote} />
      }
    </svg>
  </>;
}

export const DigitalWatchPlant: Plant<DigitalWatchProps> = {
  inputEvents: [
    { kind: "event", event: "setH", paramName: 'h' },
    { kind: "event", event: "setM", paramName: 'm' },
    { kind: "event", event: "setS", paramName: 's' },
    { kind: "event", event: "setLight", paramName: 'lightOn'},
    { kind: "event", event: "setAlarm", paramName: 'alarmOn'},
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
  initial: (raise: (event: RaisedEvent) => void) => ({
    light: false,
    alarm: false,
    h: 12,
    m: 0,
    s: 0,
    callbacks: {
      onTopLeftPressed: () => raise({ name: "topLeftPressed" }),
      onTopRightPressed: () => raise({ name: "topRightPressed" }),
      onBottomRightPressed: () => raise({ name: "bottomRightPressed" }),
      onBottomLeftPressed: () => raise({ name: "bottomLeftPressed" }),
      onTopLeftReleased: () => raise({ name: "topLeftReleased" }),
      onTopRightReleased: () => raise({ name: "topRightReleased" }),
      onBottomRightReleased: () => raise({ name: "bottomRightReleased" }),
      onBottomLeftReleased: () => raise({ name: "bottomLeftReleased" }),
    },
  }),
  reducer: (inputEvent: RaisedEvent, state: DigitalWatchProps) => {
    if (inputEvent.name === "setH") {
      return { ...state, h: inputEvent.param };
    }
    if (inputEvent.name === "setM") {
      return { ...state, m: inputEvent.param };
    }
    if (inputEvent.name === "setS") {
      return { ...state, s: inputEvent.param };
    }
    if (inputEvent.name === "setLight") {
      return { ...state, light: inputEvent.param };
    }
    if (inputEvent.name === "setAlarm") {
      return { ...state, alarm: inputEvent.param };
    }
    return state; // unknown event - ignore it
  },
  render: DigitalWatch,
}
