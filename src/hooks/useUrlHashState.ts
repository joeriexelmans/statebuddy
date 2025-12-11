import { buf2base64, deflateBuffer, inflateJSON, str2buf } from "@/compression/deflate";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

// persist state in URL hash
export function useUrlHashState<T>(recoverCallback: (recoveredState: (T|null)) => void) {
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [state, setState] = useState<T|null>(null);

  const recover = useCallback(async (compressedState: string) => {
    try {
      const recoveredState = await inflateJSON<T>(compressedState); // may throw
      recoverCallback(recoveredState);
    }
    catch (e: any) {
      console.warn(`failed to recover state!`, e);
      recoverCallback(null);
    }
  }, [recoverCallback]);

  // recover editor state from URL - we need an effect here because decompression is asynchronous
  // layout effect because we want to run it before rendering the first frame
  useLayoutEffect(() => {
    recover(window.location.hash.slice(1));
  }, []);

  // useEffect(() => {
  //   window.addEventListener("popstate", e => {
  //     recover(e.target.location.hash.slice(1));
  //   });
  // }, []);

  function persist(state: T, cancel: Promise<void>) {
    const str = JSON.stringify(state);
    const buf = str2buf(str);
    Promise.race([
      deflateBuffer(buf),
      cancel,
    ]).then((deflatedJSON)=> {
      if (deflatedJSON !== undefined) { // not canceled
        const hash = '#'+buf2base64(deflatedJSON);
        // if (window.location.hash !== hash) {
        //   window.history.pushState({}, "", hash);
        // }
        window.history.replaceState({}, "", hash);
        setState(state);
        setOriginalSize(buf.byteLength);
        setCompressedSize(deflatedJSON.byteLength);
      }
    }).catch(e => {
      console.error('failed to compress: ', e, '\ndata was:', state);
    });
  }

  return [persist, originalSize, compressedSize, state] as const;
}
