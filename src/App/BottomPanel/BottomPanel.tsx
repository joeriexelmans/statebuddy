import { Dispatch } from "react";
import { TraceableError } from "../../statecharts/parser";

import { PersistentDetails } from "../Components/PersistentDetails";

import gitRev from "@/git-rev.txt";
import { Tooltip } from "../Components/Tooltip";
import { Stats } from "./Stats";
import { Statechart, stateDescription } from "@/statecharts/abstract_syntax";

import appStyles from "../App.module.css";
import { VisualEditorState } from "../VisualEditor/VisualEditor.state";
import { BottomPanelState } from "../migrations/v2_types";
import { makePartialSetter, WithSetters } from "../makePartialSetter";

const statusStrings = {
  "notLoaded": "not loaded",
  "loading": "loading...",
  "loaded": "ready",
}

type BottomPanelProps = WithSetters<{
  state: BottomPanelState,
}> & {
  errors: TraceableError[],
  abstractSyntax: Statechart,
  pyodideStatus: "notLoaded" | "loading" | "loaded",
}

export function BottomPanel(props: BottomPanelProps) {
  const {errorsExpanded} = props.state;
  const setErrorsExpanded = makePartialSetter(props.setState, "errorsExpanded");

  return <div className="bottom">
    <div className={appStyles.stackHorizontal
            + ' ' + appStyles.statusBar
            + ' ' + (props.errors.length ? appStyles.error : ""
            + ' ' + (props.pyodideStatus === "loading" ? appStyles.pyodideLoading : "")
            )}>
      <div style={{flexGrow:1}}>
      <PersistentDetails state={errorsExpanded} setState={setErrorsExpanded}>
          <summary>{props.errors.length} errors</summary>
          <div style={{maxHeight: '20vh', overflow: 'auto'}}>
          {props.errors.map(({message, shapeUid})=>
            <div>
              {shapeUid}: {message}
            </div>)}
          </div>
        </PersistentDetails>
      </div>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <Stats abstractSyntax={props.abstractSyntax}/>
        &nbsp;|&nbsp;
        <Tooltip tooltip="MTL properties are checked with a Python library, which runs in your browser via Pyodide. Pyodide is slow to start and currently blocks the main thread, which is a known issue." above>
          Pyodide: <span style={{
            fontWeight: props.pyodideStatus === "loading" ? 600 : 400,
          }}>{statusStrings[props.pyodideStatus]}</span>
        </Tooltip>
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
