import { chunkedBinarySearch, chunkedFirst, chunkedIdxToFlat, chunkedLast, chunkedLength, chunkedPush, flatIdxToChunked } from "@/util/chunked_array";
import { diffJSON, explainDiff } from "@/util/diff";
import { MouseEvent, SetStateAction, useCallback, useState } from "react";
import { AppState } from "./App.state";
import { PersistentApp } from "./PersistentApp";

import cursorSVG from "../assets/cursor.svg";
import { useShortcuts } from "@/hooks/useShortcuts";
import { MouseIcon } from "./TopPanel/MouseIcon";

type AppStateWithCursor = {
  s: AppState | undefined,
  c: {x: number, y: number, buttons: number},
  t: number, // Unix timestamp
}

const appStart = Date.now();

export function SpyingApp() {
  const [appHistory, setAppHistory] = useState<{h: (AppStateWithCursor)[][], i: number, j: number}>({h:[[{s: undefined, c: {x:-100,y:-100,buttons:0}, t: appStart}]], i:0, j:0});
  const appState = appHistory.h[appHistory.i]?.[appHistory.j]?.s;

  const [paused, setPaused] = useState(false);

  useShortcuts([
    {keys: ["Ctrl", "/"], action: () => setPaused(p => !p)},
  ])

  const setAppStateButKeepHistory = useCallback((value: SetStateAction<AppState|undefined>) => {
    setAppHistory(({h, i, j}) => {
      if (i !== h.length-1 || j !== h[i].length-1 || paused) {
        // you're looking at an old state -> app is read-only
        return {h, i, j};
      }

      const t = Date.now();
      const oldState = h[i][j];
      let newAppState;
      if (typeof value === 'function') {
        newAppState = value(oldState.s!);
      }
      else {
        newAppState = value;
      }
      const newState = {s: newAppState, c: oldState.c, t};
      const diff = diffJSON(oldState.s, newState.s);
      if (diff.kind === "nochange") return {h, i, j};
      else {
        // console.log(explainDiff(diff).join('\n'), diff, oldState, newState);
        const newHistory = chunkedPush(h, newState);
        return {
          h: newHistory,
          i: newHistory.length-1,
          j: newHistory.at(-1)!.length-1,
        };
      }
    })
  }, [setAppHistory, paused]);

  const pushState = useCallback((state: (old: AppStateWithCursor) => AppStateWithCursor) => {
    setAppHistory(({h, i, j}) => {
      if (i !== h.length-1 || j !== h[i].length-1 || paused) {
        // you're looking at an old state -> app is read-only
        return {h, i, j};
      }
      const newHistory = chunkedPush(h, state(h[i][j]));
      return {
        h: newHistory,
        i: newHistory.length-1,
        j: newHistory.at(-1)!.length-1,
      }
    })
  }, [setAppHistory, paused]);

  // useEffect(() => {
  //   (async () => {
  //   // @ts-ignore
  //   const cborBuf = CBOR.encode(appHistory) as ArrayBuffer;
  //   console.log('history:', cborBuf.byteLength);
  //   const cborZipBuf = await deflateBuffer(new Uint8Array(cborBuf));
  //   console.log('zipped:', cborZipBuf.byteLength);
  //   })();
  // }, [appHistory]);

  const cur = appHistory.h[appHistory.i][appHistory.j];

  const mouseEventHandler = (e: MouseEvent<HTMLDivElement>) => !paused && pushState(({s}) => ({
    s,
    c: {x: e.clientX, y: e.clientY, buttons: e.buttons},
    t: Date.now(),
  }));

  return <div style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative'}}>
    <div
      style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', flexGrow: 1}}
    >
      <div style={{display: 'flex', overflow: 'hidden', flexGrow: 1}}
        onMouseMove={mouseEventHandler}
        onMouseDown={mouseEventHandler}
        onMouseUp={mouseEventHandler}
      >
        <PersistentApp appState={appState} setAppState={setAppStateButKeepHistory} />
      </div>
      {paused && cur && <input
        type="range"
        style={{width: '100vw'}}
        min={0}
        max={chunkedLength(appHistory.h)-1}
        value={chunkedIdxToFlat(appHistory)}
        // min={chunkedFirst(appHistory.h).t}
        // max={chunkedLast(appHistory.h)!.t}
        // value={cur.t}
        onChange={e => {
          const target = Math.round(Number(e.target.value));
          setAppHistory(({h}) => ({
            h,
            ...flatIdxToChunked(target)
          }));
        }}
        // onChange={e => {
        //   const targetTimestamp = Number(e.target.value);
        //   const found = chunkedBinarySearch(
        //     appHistory.h,
        //     {t: Infinity} as AppStateWithCursor,
        //     (s, n) => {
        //       if (targetTimestamp < s.t) {return "toobig"}
        //       else if (targetTimestamp >= n.t) {return "toosmall"}
        //       else if (targetTimestamp - s.t < n.t - targetTimestamp) return "eq-smaller"; else return "eq-bigger";
        //     });
        //   setAppHistory(({h}) => ({
        //     h,
        //     ...found,
        //   }))}}
      />}
    </div>

    {cur && paused &&
      <div style={{position: 'absolute', left: cur.c.x-4, top: cur.c.y-2, fontSize: 24, pointerEvents: 'none', zIndex: 100}}>
        <img src={cursorSVG} width={cur.c.buttons ? 28 : 24}/>
        {cur.c.buttons && <MouseIcon
          left={Boolean(cur.c.buttons & 1)}
          right={Boolean(cur.c.buttons & 2)}
          middle={Boolean(cur.c.buttons & 4)}
          /> || <></>}
      </div>
    }
  </div>;
}
