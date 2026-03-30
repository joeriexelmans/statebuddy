import styles from "./App.module.css";
import { buf2string, deflateBuffer, inflateBuf } from "@/compression/deflate";
import { Encoder } from "cbor-x";
import { Dispatch, ReactNode, SetStateAction, useState } from "react";
import { useUrlHashState } from "../hooks/useUrlHashState";
import { lossyCompressConcreteSyntax } from "../statecharts/concrete_syntax";
import { myPureDeepAssign } from "../util/util";
import { App } from "./App";
import { AppState, defaultAppState } from "./App.state";
import { CrashScreen } from "./CrashScreen";
import { autoMigrate } from "./migrations/auto_migrate";

const CBOR = new Encoder({
  structuredClone: true,
  // useRecords: true, // <-- no difference in size, not compatible with other CBOR implementations
  // pack: true, // <-- packing only slightly reduces encoded size, and if we DEFLATE the resulting buffer, there is no difference!
});

// Example model: digital watch (without edit history)
//
//                      | raw   | deflated
//    ------------------|-------|---------
//    JSON              | 15240 |     3523
//    CBOR              |  7605 |     3388
//    CBOR + useRecords |  7605 |     3388  <-- no difference!
//    CBOR + pack       |  6836 |     3439  <-- pack + zip is worse

// Example model: 294 AND-states, 237 transitions
//
//                      | raw   | deflated
//    ------------------|-------|---------
//    JSON              | 54730 |     9011
//    CBOR              | 21978 |     7689  
//    CBOR + useRecords | 21978 |     7689  <-- no difference!
//    CBOR + pack       | 21946 |     7704  <-- pack + zip is worse

// Some insights:
//  - Structural sharing saves a lot of space when performing many small edits (this is expected)
//  - Without edit history:
//       - CBOR wins from JSON
//       - DEFLATE(CBOR) about as good as DEFLATE(JSON)
//  - DEFLATE(CBOR) vs DEFLATE(CBOR+pack) makes almost no difference
// 
// Conclusion:
//    - The ability to round-trip with Map, Set, and structural sharing is a big win for CBOR.
//         (in principle, a layer on top of JSON could achieve the same thing...)
//    - If I want to encode edit histories with structural sharing, CBOR obviously much better
//         (the question remains if I really want to encode edit histories because even with CBOR they consume a lot of data)

function PENDING() {
  return <span style={{fontFamily: 'monospace'}}>[ .. ]</span>;
}
function OK() {
  return <span style={{fontFamily: 'monospace'}}>[<span style={{color: 'var(--status-ok-color)'}}> OK </span>]</span>;
}
function FAIL() {
  return <span style={{fontFamily: 'monospace'}}>[<span style={{color: 'var(--status-nok-color)', fontFamily: 'monospace'}}>FAIL</span>]</span>;
}

function LoadingSteps({steps}: {steps: [ReactNode, string][]}) {
  return <div style={{textAlign: 'left', display: 'inline-block'}}>
    {steps.map(([status, step], i) =>
      <div>{status} {step}</div>
    )}
  </div>;
}

const msgs = {
  parseUrlBase64: "base64-decode URL hash",
  decompress: "DEFLATE-decompress",
  parseCBOR: "CBOR-decode",
  parseJSON: "instead try JSON-decode",
}

// A wrapper around <App> that persists the app state in URL hash
export function PersistentApp() {
  
  const [err, setErr] = useState<ReactNode>();
  const [appState, setAppState, modelSize] = useUrlHashState<AppState>(
    100, // ms of inactivity before state is compressed and persisted in URL hash

    // encode to URL:
    async ({ syntax: { editorState: {current, ...editorState}, ...syntax }, ...appState }) => {
      const compressed: AppState = {
        syntax: {
          editorState: {
            current: lossyCompressConcreteSyntax(current),
            ...editorState,
            // history: [],
            // future: [],
          },
          ...syntax,
        },
        ...appState
      };
      // @ts-ignore: this works...
      const cborBuf = CBOR.encode(compressed) as ArrayBuffer;
      const cborZipBuf = await deflateBuffer(new Uint8Array(cborBuf));

      // console.log('CBOR', cborBuf.byteLength, 'bytes');
      // console.log('CBOR zipped', cborZipBuf.byteLength, 'bytes');

      // const jsonBuf = str2buf(JSON.stringify(compressed));
      // console.log('JSON', jsonBuf.byteLength, 'bytes');

      // const jsonZipBuf = (await deflateString(JSON.stringify(compressed)));
      // console.log('JSON zipped', jsonZipBuf.byteLength, 'bytes');

      return cborZipBuf;
    },

    // decode from URL:
    async buf => {
      if (buf.byteLength === 0) {
        // empty URL hash -> initial state
        return defaultAppState;
      }

      let inflated;

      try {
        inflated = await inflateBuf(new Uint8Array(buf));

        let stateUnknown;
        try {
          stateUnknown = CBOR.decode(new Uint8Array(inflated));
        }
        catch (cborErr) {
          try {
            const str = buf2string(inflated);
            stateUnknown = JSON.parse(str);
          } catch (jsonErr) {
            console.error({cborErr, jsonErr});

            setErr(<LoadingSteps steps={[
              [<OK/>, msgs.parseUrlBase64],
              [<OK/>, msgs.decompress],
              [<FAIL/>, msgs.parseCBOR],
              [<FAIL/>, msgs.parseJSON],
            ]}/>);

            return;
          }
        }
        const migrated = autoMigrate(stateUnknown);
        return myPureDeepAssign(defaultAppState, migrated);
      }
      catch (inflateErr) {
        console.error({inflateErr});

        setErr(<LoadingSteps steps={[
          [<OK/>, msgs.parseUrlBase64],
          [<FAIL/>, msgs.decompress],
          [<PENDING/>, msgs.parseCBOR],
        ]}/>);
      }
    },

    err => {
      console.error(err);

      setErr(<LoadingSteps steps={[
        [<FAIL/>, msgs.parseUrlBase64],
        [<PENDING/>, msgs.decompress],
        [<PENDING/>, msgs.parseCBOR],
      ]}/>);
    },
  );

  let setAppStateDefined;
  
  // setAppStateDefined = useCallback((callback: (SetStateAction<AppState> | AppState)) => {
  //   setAppState(appState => {
  //     if (appState === undefined) {
  //       // can this happen? i'm not totally sure
  //       throw new Error("the impossible happened ?!");
  //     }
  //     else {
  //       if (typeof callback === "function") {
  //         return callback(appState);
  //       }
  //       else {
  //         return callback;
  //       }
  //     }
  //   });
  // }, [setAppState]);

  // in production mode, we bypass the above and just do a type cast
  setAppStateDefined = setAppState as Dispatch<SetStateAction<AppState>>;

  // @ts-ignore: also useful for debugging!
  window['appState'] = appState;

  return <div className={styles.App}>
    {err ? <CrashScreen>
            <h1>Failed to restore state from URL</h1>
            <div style={{height: '2em'}}/>
            <h3>{err}</h3>
            <div style={{height: '2.5em'}}/>
            <button onClick={() => {
              setErr(undefined);
              setAppState(defaultAppState);
            }}>RESET APP</button>
          </CrashScreen>
        : appState
          ? <App appState={appState} setAppState={setAppStateDefined} modelSize={modelSize} />
          : <>Loading ...</>
    }
  </div>
}
