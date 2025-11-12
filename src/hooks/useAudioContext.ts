import { memoize } from "@/util/util";
import { useCallback, useEffect, useRef, useState } from "react";


// I was trying to get the 'microwave running' sound to play gapless on Chrome, and the Web Audio API turned out to be the only thing that worked properly. It has some nice bonus features as well, such as setting the playback rate, and audio filters.

// The result is a simple Web Audio API wrapper for React:

export function useAudioContext(speed: number) {
  const ref = useRef<{ctx: AudioContext, hipass: BiquadFilterNode}>(null);

  useEffect(() => {
    if (!ref.current) {
      const audioCtx = new AudioContext();
      const hipass = audioCtx.createBiquadFilter();
      hipass.type = 'highpass';
      hipass.frequency.value = 20; // Hz (let's not blow up anyone's speakers)
      hipass.connect(audioCtx.destination);
      ref.current = { ctx: audioCtx, hipass };
    }
  }, []);

  const [sounds, setSounds] = useState<AudioBufferSourceNode[]>([]);

  const url2AudioBuf: (url:string) => Promise<AudioBuffer> = useCallback(memoize((url: string) => {
    return fetch(url)
      .then(res => res.arrayBuffer())
      .then(buf => ref.current!.ctx.decodeAudioData(buf));
  }), [ref.current]);

  function play(url: string, loop: boolean, gain: number = 1) {
    const srcPromise = url2AudioBuf(url)
      .then(audioBuf => {
        const src = ref.current!.ctx.createBufferSource();
        const gainNode = ref.current!.ctx.createGain();
        gainNode.gain.value = gain;
        gainNode.connect(ref.current!.hipass);
        src.buffer = audioBuf;
        src.connect(gainNode);
        src.playbackRate.value = speed;
        src.loop = loop;
        src.start();
        setSounds(sounds => [...sounds, src]);
        src.addEventListener("ended", () => {
          setSounds(sounds => sounds.filter(s => s !== src));
        })
        return src;
      });
    // return callback to stop playing
    return () => srcPromise.then(src => src.stop());
  }

  useEffect(() => {
    if (speed !== 0) {
      sounds.forEach(src => {
        src.playbackRate.value = speed;
      });
      ref.current!.ctx.resume();
    }
    else {
      ref.current!.ctx.suspend();
    }
  }, [speed]);

  return [play, url2AudioBuf] as [(url: string, loop: boolean, gain?: number) => ()=>void, (url:string)=>void];
}
