import { buf2base64, deflateBuffer, inflateJSON, str2buf } from "@/compression/deflate";
import { useLayoutEffect, useState } from "react";

// persist state in URL hash
export function useUrlHashState<T>(recoverCallback: (recoveredState: (T|null)) => void) {
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

  // recover editor state from URL - we need an effect here because decompression is asynchronous
  // layout effect because we want to run it before rendering the first frame
  useLayoutEffect(() => {
    const recoverState = async () => {
      const compressedState = window.location.hash.slice(1);
      try {
        const recoveredState = await inflateJSON<T>(compressedState); // may throw
        recoverCallback(recoveredState);
      }
      catch (e: any) {
        console.warn(`failed to recover state! error was: ${e.message}`);
        recoverCallback(null);
      }
    };
    recoverState();
  }, []);

  function persist(state: T, cancel: Promise<void>) {
    const str = JSON.stringify(state);
    const buf = str2buf(str);
    Promise.race([
      deflateBuffer(buf),
      cancel,
    ]).then((deflatedJSON)=> {
      if (deflatedJSON !== undefined) { // not canceled
        window.location.hash = '#'+buf2base64(deflatedJSON);
        setOriginalSize(buf.byteLength);
        setCompressedSize(deflatedJSON.byteLength);
      }
    }).catch(e => {
      console.error('failed to compress: ', e, '\ndata was:', state);
    });
  }

  return [persist, originalSize, compressedSize] as const;
}
