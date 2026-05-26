import { useEffect, useState } from "react";
import { useDelayedEffect } from "./useDelayedEffect";
import { base642buf, buf2base64 } from "../compression/deflate";

export type ModelSize = {
  original: number,
  compressed: number,
}

// persist state in URL hash
export function useUrlHashState<StateType>(
  delayMs: number,
  encode: (s: StateType) => Promise<ArrayBuffer>,
  decode: (h: ArrayBuffer) => Promise<StateType>,
  onErr: (err: any) => void,
) {
  const [state, setState] = useState<StateType|undefined>(undefined);
  const [size, setSize] = useState<ModelSize>({compressed: 0, original: 0});

  useEffect(() => {
    const loadFromURL = () => {
      
      const str = window.location.hash.slice(1);
      try {
        const buf = base642buf(str);
        decode(buf.buffer)
          .then(setState)
          .catch(onErr);
      } catch (e) {
        onErr(e);
      }
    }

    // on startup, decompress and JSON-parse the state:
    loadFromURL();

    // when user (manually) changes hash, also reload:
    window.addEventListener("hashchange", e => {
      console.log('hash changed ... reloading');
      loadFromURL();
    })
  }, []);

  // every time state changes, JSON-serialize and compress the state:
  useDelayedEffect(() => {
    if (state) {
      const {promise: cancelPromise, resolve: cancel} = Promise.withResolvers<undefined>();
      Promise.race([
        encode(state),
        cancelPromise
      ]).then(buf => {
        if (buf !== undefined) { // not canceled
          const str = buf2base64(buf);
          const hash = '#'+str;
          window.history.replaceState({}, "", hash);
          setSize({original: 0, compressed: str.length});
        }
      });
      return cancel;
    }
  }, delayMs, [state])

  return [state, setState, size] as const;
}
