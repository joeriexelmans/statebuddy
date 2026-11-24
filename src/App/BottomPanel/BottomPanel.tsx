import { Dispatch, SetStateAction } from "react";
import { TraceableError } from "../../languages/statecharts/parser/parser";

import { gitRev } from "virtual:git-rev";

import { Tooltip } from "../Components/Tooltip";
import { Stats } from "./Stats";
import { AbstractSyntax } from "@/languages/statecharts/abstract_syntax";

import appStyles from "../App.module.css";
import { WithSetters } from "../../util/partial_setter";
import { Toolbar } from "../TopPanel/Toolbar";
import { MtlWorkerPoolState } from "@/mtl-checker/useMtlWorkerPool";
import { Selection } from "../VisualEditor/VisualEditor.state";
import { MyDetails } from "../Components/MyDetails";
import { ModelSize } from "@/hooks/useUrlHashState";
import { prettyNumber } from "@/util/pretty";

type BottomPanelProps = WithSetters<{
  errorsExpanded: boolean,
}> & {
  modelSize: ModelSize,
  errors: TraceableError[],
  abstractSyntax: AbstractSyntax,
  workerPoolState: MtlWorkerPoolState,
  setNWorkers: Dispatch<SetStateAction<number>>,
  setExtraHighlight: Dispatch<SetStateAction<Set<string>>>,
  setSelection: Dispatch<SetStateAction<Selection>>;
}

export function BottomPanel({
  modelSize,
  errorsExpanded,
  setErrorsExpanded,
  errors,
  abstractSyntax,
  workerPoolState,
  setNWorkers,
  setExtraHighlight,
  setSelection
}: BottomPanelProps) {
  const searchParams = new URLSearchParams(window.location.search);

  const nBooting = workerPoolState.workers.filter(w => w.state === "booting").length;
  const nReady = workerPoolState.workers.filter(w => w.state === "ready").length;
  const nWorking = workerPoolState.workers.filter(w => w.state === "working").length;

  return <div className="bottom">
    <div className={appStyles.stackHorizontal
            + ' ' + appStyles.statusBar
            + ' ' + (errors.length ? appStyles.error : ""
          )}
          style={{alignItems: 'end'}}>
      <div style={{flexGrow:1}}>
      <MyDetails open={errorsExpanded} setOpen={setErrorsExpanded}>
          <summary>{errors.length} errors</summary>
          <div style={{maxHeight: '20vh', overflow: 'auto'}}>
          {errors.map(({message, shapes}, i)=>
            <div
              key={`${i}-${message}`}
              style={{cursor: 'pointer'}}
              onMouseEnter={() => setExtraHighlight(() => new Set(shapes))}
              onMouseLeave={() => setExtraHighlight(() => new Set())}
              onClick={() => setSelection(new Map(shapes.map(shapeUid => [shapeUid, new Set(["start", "end", "left", "right", "top", "bottom", "text"])] as const)))}
            >
              {shapes.join(', ')}: {message}
            </div>)}
          </div>
        </MyDetails>
      </div>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <Tooltip
          tooltip={`model size\nuncompressed: ${prettyNumber(modelSize.original)} bytes`}
          above
        >{prettyNumber(modelSize.compressed)} bytes zipped ({Math.round(modelSize.compressed/modelSize.original*100)}%)</Tooltip>
        &emsp;|&emsp;
        <Stats abstractSyntax={abstractSyntax}/>
        &emsp;|&emsp;
          <Tooltip tooltip="MTL properties are checked with a Python library, which runs in your browser via Pyodide. Each worker is an instance of Python running in its own thread." above>
            MTL worker pool:
            &nbsp;
            <span>{nBooting} booting / {nReady} idle / {nWorking} working</span>
          </Tooltip>
          &nbsp;
          <Toolbar>
            <Tooltip above tooltip="remove worker">
              <button onClick={() => setNWorkers(n => Math.max(0, n-1))} style={{height: 20}}>-</button>
            </Tooltip>
            <Tooltip above tooltip="add worker">
              <button onClick={() => setNWorkers(n => Math.min(n+1, 8))} style={{height: 20}}>+</button>
            </Tooltip>
          </Toolbar>
          &nbsp;
          {workerPoolState.queue.length} jobs queued
        
        {searchParams.get("dev") === "1" && <>
          &emsp;|&emsp;
          switch to&nbsp;
            {location.host === "localhost:3000" ?
              <a href={`https://deemz.org/public/statebuddy/v2/${location.search}${location.hash}`}>production</a>
              : <a href={`http://localhost:3000/${location.search}${location.hash}`}>development</a>
            }
          &nbsp;mode
        </>}
        &emsp;|&emsp;
        Rev:&nbsp;
        <Tooltip tooltip="view source code" align="right" above={true}>
          <a href={`https://deemz.org/git/research/statebuddy/commit/${gitRev}`} target="_blank">
            {gitRev.slice(0,8)}
          </a>
        </Tooltip>
      </div>
    </div>
  </div>;
}
