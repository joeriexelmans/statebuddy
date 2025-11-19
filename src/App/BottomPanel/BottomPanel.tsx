import { Dispatch } from "react";
import { TraceableError } from "../../statecharts/parser";

import "./BottomPanel.css";

import { PersistentDetails } from "../Components/PersistentDetails";
import { AppState } from "../App";
import { VisualEditorState } from "../VisualEditor/VisualEditor";
import { Setters } from "../makePartialSetter";

import gitRev from "@/git-rev.txt";
import { Tooltip } from "../Components/Tooltip";

export type BottomPanelState = {
  errorsExpanded: boolean,
}

export const defaultBottomPanelState = {
  errorsExpanded: false,
}

export function BottomPanel(props: {errors: TraceableError[], setEditorState: Dispatch<(state: VisualEditorState) => VisualEditorState>} & AppState & Setters<AppState>) {

  return <div className="bottom">
    <div className={"stackHorizontal statusBar" + (props.errors.length ? " error" : "")}>
      <div style={{flexGrow:1}}>
      <PersistentDetails state={props.errorsExpanded} setState={props.setErrorsExpanded}>
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
        switch to&nbsp;
        <Tooltip tooltip="only works if you are running a development server locally" above={true}>
          {location.host === "localhost:3000" ?
            <a href={`https://deemz.org/public/statebuddy/${location.hash}`}>production</a>
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
