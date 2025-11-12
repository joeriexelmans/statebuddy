import { useEffect, useLayoutEffect } from "react";

// persist state in URL hash
export function useUrlHashState<T>(recoverCallback: (recoveredState: (T|null)) => void): (toPersist: T) => void {

  // recover editor state from URL - we need an effect here because decompression is asynchronous
  // layout effect because we want to run it before rendering the first frame
  useLayoutEffect(() => {
    console.log('recovering state...');
    const compressedState = window.location.hash.slice(1);
    if (compressedState.length === 0) {
      // empty URL hash
      console.log("no state to recover");
      return recoverCallback(null);
    }
    let compressedBuffer;
    try {
      compressedBuffer = Uint8Array.fromBase64(compressedState); // may throw
    } catch (e) {
      // probably invalid base64
      console.error("failed to recover state:", e);
      return recoverCallback(null);
    }
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(compressedBuffer).catch(() => {}); // any promise rejections will be detected when we try to read
    writer.close().catch(() => {});
    new Response(ds.readable).arrayBuffer()
      .then(decompressedBuffer => {
        const recoveredState = JSON.parse(new TextDecoder().decode(decompressedBuffer));
        console.log('successfully recovered state');
        recoverCallback(recoveredState);
      })
      .catch(e => {
        // any other error: invalid JSON, or decompression failed.
        console.error("failed to recover state:", e);
        recoverCallback(null);
      });
  }, []);

  function persist(state: T) {
    const serializedState = JSON.stringify(state);
    const stateBuffer = new TextEncoder().encode(serializedState);
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    writer.write(stateBuffer);
    writer.close();
    // todo: cancel this promise handler when concurrently starting another compression job
    new Response(cs.readable).arrayBuffer().then(compressedStateBuffer => {
      const compressedStateString = new Uint8Array(compressedStateBuffer).toBase64();
      window.location.hash = "#"+compressedStateString;
    });
  }

  return persist;
}
