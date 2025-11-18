import { AppState } from "@/App/App";
import { useEffect, useLayoutEffect } from "react";

// persist state in URL hash
export function useUrlHashState<T>(recoverCallback: (recoveredState: (T|null)) => void): (toPersist: T) => void {

  // recover editor state from URL - we need an effect here because decompression is asynchronous
  // layout effect because we want to run it before rendering the first frame
  useLayoutEffect(() => {
    const recoverState = async () => {
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
        console.error("failed to recover state (invalid base64):", e);
        return recoverCallback(null);
      }
      const ds = new DecompressionStream("deflate");
      const writer = ds.writable.getWriter();
      writer.write(compressedBuffer).catch(() => {}); // any promise rejections will be detected when we try to read
      writer.close().catch(() => {});

      let decompressedBuffer;
      try {
        decompressedBuffer = await new Response(ds.readable).arrayBuffer();
      }
      catch (e) {
        console.error("failed to recover state (valid base64 but corrupted data):", e);
        recoverCallback(null);
        return;
      }

      let decoded;
      try {
        decoded = new TextDecoder().decode(decompressedBuffer);
      }
      catch (e) {
        console.error("failed to recover state (could not decode buffer to UTF-8):", e);
        recoverCallback(null);
        return;
      }

      let recoveredState;
      try {
        recoveredState = JSON.parse(decoded);
      }
      catch (e) {
        console.error("failed to recover state (invalid JSON):", e);
        recoverCallback(null);
        return;
      }

      recoverCallback(recoveredState);
    };
    recoverState();
  }, []);

  function persist(state: T) {
    toURL(state).then(str => window.location.hash = '#'+str);
  }

  return persist;
}

export function toURL<T>(state: T): Promise<string> {
    const serializedState = JSON.stringify(state);
    const stateBuffer = new TextEncoder().encode(serializedState);
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    writer.write(stateBuffer);
    writer.close();
    // todo: cancel this promise handler when concurrently starting another compression job
    return new Response(cs.readable).arrayBuffer().then(compressedStateBuffer => {
      const compressedStateString = new Uint8Array(compressedStateBuffer).toBase64();
      return compressedStateString;
    });
}
