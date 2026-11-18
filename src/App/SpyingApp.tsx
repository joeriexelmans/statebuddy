import { chunkedBinarySearch, chunkedFirst, chunkedIdxToFlat, chunkedLast, chunkedLength, chunkedPush, flatIdxToChunked } from "@/util/chunked_array";
import { diffJSON, explainDiff } from "@/util/diff";
import { ChangeEvent, ChangeEventHandler, MouseEvent, SetStateAction, useCallback, useEffect, useState } from "react";
import { AppState } from "./App.state";
import { PersistentApp } from "./PersistentApp";

import cursorSVG from "../assets/cursor.svg";
import { useShortcuts } from "@/hooks/useShortcuts";
import { MouseIcon } from "./TopPanel/MouseIcon";
import { TwoStateButton } from "./Components/TwoStateButton";

import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import { Encoder } from "cbor-x";
import { deflateBuffer, inflateBuf } from "@/compression/deflate";
import { downloadArrayBuffer } from "@/util/download_file";

const CBOR = new Encoder({
  structuredClone: true,
  // useRecords: true, // <-- no difference in size, not compatible with other CBOR implementations
  // pack: true, // <-- packing only slightly reduces encoded size, and if we DEFLATE the resulting buffer, there is no difference!
});

type AppStateWithCursor = {
  s: AppState | undefined,
  c: {x: number, y: number, buttons: number}, // <-- cursor state
  w: {width: number, height: number}, // <-- window inner size
  t: number, // Unix timestamp
}

const appStart = Date.now();

export function SpyingApp() {
  const [appHistory, setAppHistory] = useState<{h: (AppStateWithCursor)[][], i: number, j: number}>({h:[[{s: undefined, c: {x:-100,y:-100,buttons:0}, w: {width:window.innerWidth, height:window.innerHeight},  t: appStart}]], i:0, j:0});
  const appState = appHistory.h[appHistory.i]?.[appHistory.j]?.s;

  const [paused, setPaused] = useState(false);

  useShortcuts([
    {keys: ["Ctrl", "."], action: () => setPaused(p => !p)},
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
      const newState = {s: newAppState, c: oldState.c, t, w: oldState.w};
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

  const cur = appHistory.h[appHistory.i][appHistory.j];

  const mouseEventHandler = (e: MouseEvent<HTMLDivElement>) => !paused && pushState(({s, w}) => ({
    s,
    c: {x: e.clientX, y: e.clientY, buttons: e.buttons},
    t: Date.now(),
    w,
  }));

  const now = new Date(appHistory.h[appHistory.i][appHistory.j].t);

  const onExport = useCallback(async () => {
    // @ts-ignore: this works...
    const cborBuf = CBOR.encode(appHistory.h) as ArrayBuffer;
    const cborZipBuf = await deflateBuffer(new Uint8Array(cborBuf));
    downloadArrayBuffer(cborZipBuf, "application/cbor", (appState?.view.topPanel.modelName||"untitled") + ".sblog");
  }, [appHistory.h]);

  const onImport = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) {
        alert('no file!!');
        return;
      }
      const cborZipBuf = await file.arrayBuffer();
      const cborBuf = await inflateBuf(new Uint8Array(cborZipBuf));
      const h = CBOR.decode(new Uint8Array(cborBuf));
      setAppHistory({h, i: h.length-1, j: h.at(-1).length-1});
      setPaused(true);
    } catch (e) {
      // @ts-ignore
      alert('import failed!! ' + e.message);
    }
  }, [setAppHistory, setPaused]);

  const onResize = useCallback(() => {
    pushState(({s, c}) => ({
      s,
      c,
      t: Date.now(),
      w: {width: window.innerWidth, height: window.innerHeight},
    }))
  }, [pushState])

  useEffect(() => {
    if (!paused) {
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [paused]);

  return <div style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100vw'}}>
    <div
      style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', flexGrow: 1}}
    >
      <div style={{display: 'flex',
        overflow: 'hidden',
        flexGrow: 1,
        alignContent: 'center',
        alignItems: paused ? 'center' : undefined,
        justifyContent: 'center',
        backgroundColor: 'light-dark(#1b45ff52, rgba(28, 71, 100, 0.377))',
      }}
        onMouseMove={mouseEventHandler}
        onMouseDown={mouseEventHandler}
        onMouseUp={mouseEventHandler}
      >
        <div style={{
          position: 'relative',
          display: 'flex',
          width: paused ? cur.w.width : undefined,
          height: paused ? cur.w.height : undefined,
          overflow: 'hidden',
        }}>
          <PersistentApp appState={appState} setAppState={setAppStateButKeepHistory} />
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
        </div>
      </div>
      {paused && cur && <div style={{display: 'flex', width: '100vw', alignItems: 'center', position: 'absolute', bottom: 0, backgroundColor: 'var(--background-color)'}}>
        <div style={{width: 'fit-content'}}>app paused</div>
        &nbsp;
        {/* <button disabled={paused} onClick={() => setPaused(p => !p)} title="pause app"><PauseIcon fontSize="small"/></button> */}
        <input
          disabled={!paused}
          type="range"
          style={{flexGrow: 1}}
          min={0}
          max={chunkedLength(appHistory.h)-1}
          value={chunkedIdxToFlat(appHistory)}
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
        />
        <button disabled={!paused} onClick={() => {setAppHistory(h => ({...h, i: h.h.length-1, j: h.h.at(-1)!.length-1})); setPaused(false)}} title="resume app">
          {/* <SkipNextIcon fontSize="small"/> */}
          <PlayArrowIcon fontSize="small"/>
          <FiberManualRecordIcon fontSize="small"/>
        </button>
        &nbsp;
        <div style={{width: 'fit-content'}}>{now.toISOString()}</div>
        &emsp;
        <div style={{width: 'fit-content'}}>{cur.w.width}x{cur.w.height}</div>
        &nbsp;
        <input type="file" id="fileInput" hidden onChange={onImport}/>
        <button title="import recording" onClick={() => {document.getElementById("fileInput")?.click()}}><FileUploadIcon fontSize="small"/></button>
        <button title="export recording" onClick={onExport}><FileDownloadIcon fontSize="small"/></button>
      </div>}
    </div>
  </div>;
}
