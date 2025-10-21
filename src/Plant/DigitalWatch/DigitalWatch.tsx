import { useRef } from "react";

import imgNote from "./noteSmall.png";
import imgWatch from "./watch.png";
import imgWatchLight from "./watch-light.png";
import digitalFont from "./digital-font.ttf";

type DigitalWatchProps = {
  light: boolean;
  h: number;
  m: number;
  s: number;
  alarm: boolean;
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
  const refText = useRef(null);
  const twoDigits = (n: number) => ("0"+n.toString()).slice(-2);
  const hhmmss = `${twoDigits(h)}:${twoDigits(m)}:${twoDigits(s)}`;

  return <>
    <style>{`
      @font-face{
        font-family: 'digital-font';
        src: url(${digitalFont});
      }
    `}</style>
    <svg version="1.1" width="222" height="236">
      {light ?
        <image width="222" height="236" xlinkHref={imgWatchLight}/>
      : <image width="222" height="236" xlinkHref={imgWatch}/>
      }

      <text ref={refText} x="111" y="126" dominant-baseline="middle" text-anchor="middle" fontFamily="digital-font" fontSize={28}>{hhmmss}</text>
    
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
