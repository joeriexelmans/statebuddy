import { Dispatch, SetStateAction } from "react";
import { TraceableError } from "../../statecharts/parser";

import { PersistentDetails } from "../Components/PersistentDetails";

import gitRev from "@/git-rev.txt";
import { Tooltip } from "../Components/Tooltip";
import { Stats } from "./Stats";
import { Statechart } from "@/statecharts/abstract_syntax";

import appStyles from "../App.module.css";
import { WithSetters } from "../makePartialSetter";
import { WorkerPoolState } from "@/mtl-checker/useWorkerPool";
import { Toolbar } from "../TopPanel/Toolbar";

const statusStrings = {
  "notLoaded": "not loaded",
  "loading": "loading...",
  "loaded": "ready",
}

type BottomPanelProps = WithSetters<{
  errorsExpanded: boolean,
}> & {
  errors: TraceableError[],
  abstractSyntax: Statechart,
  workerPoolState: WorkerPoolState,
  setNWorkers: Dispatch<SetStateAction<number>>,
}

export function BottomPanel({
  errorsExpanded,
  setErrorsExpanded,
  errors,
  abstractSyntax,
  workerPoolState,
  setNWorkers,
}: BottomPanelProps) {

  const nBooting = workerPoolState.workers.filter(w => w.state === "booting").length;
  const nReady = workerPoolState.workers.filter(w => w.state === "ready").length;
  const nWorking = workerPoolState.workers.filter(w => w.state === "working").length;

  return <div className="bottom">
    <div className={appStyles.stackHorizontal
            + ' ' + appStyles.statusBar
            + ' ' + (errors.length ? appStyles.error : ""
            // + ' ' + (pyodideStatus === "loading" ? appStyles.pyodideLoading : "")
          )}>
      <div style={{flexGrow:1}}>
      <PersistentDetails state={errorsExpanded} setState={setErrorsExpanded}>
          <summary>{errors.length} errors</summary>
          <div style={{maxHeight: '20vh', overflow: 'auto'}}>
          {errors.map(({message, shapeUid})=>
            <div>
              {shapeUid}: {message}
            </div>)}
          </div>
        </PersistentDetails>
      </div>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <Stats abstractSyntax={abstractSyntax}/>
        &nbsp;|&nbsp;
          <Tooltip tooltip="MTL properties are checked with a Python library, which runs in your browser via Pyodide. Each worker is an instance of Python running in its own thread." above>
            MTL worker pool:
            &nbsp;
            <span>{nBooting} booting / {nReady} ready / {nWorking} working</span>
          </Tooltip>
          &nbsp;
          <Toolbar>
            <Tooltip above tooltip="remove worker">
              <button onClick={() => setNWorkers(n => Math.max(1, n-1))}>-</button>
            </Tooltip>
            <Tooltip above tooltip="add worker">
              <button onClick={() => setNWorkers(n => Math.min(n+1, 8))}>+</button>
            </Tooltip>
          </Toolbar>
          &nbsp;
          {workerPoolState.queue.length} jobs queued
        
        &nbsp;|&nbsp;
        switch to&nbsp;
        <Tooltip tooltip="only works if you are running a development server locally" above={true}>
          {location.host === "localhost:3000" ?
            <a href={`https://deemz.org/public/statebuddy/v2/${location.hash}`}>production</a>
            : <a href={`http://localhost:3000/${location.hash}`}>development</a>
          }
        </Tooltip>
        &nbsp;mode
        &nbsp;|&nbsp;
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
