import { Dispatch, useEffect, useState } from "react";
import { TraceableError } from "../../statecharts/parser";

import "./BottomPanel.css";

import { PersistentDetailsLocalStorage } from "../Components/PersistentDetails";
import { Logo } from "@/App/Logo/Logo";
import { AppState } from "../App";
import { VisualEditorState } from "../VisualEditor/VisualEditor";
import { Setters } from "../makePartialSetter";

import gitRev from "@/git-rev.txt";

export function BottomPanel(props: {errors: TraceableError[], setEditorState: Dispatch<(state: VisualEditorState) => VisualEditorState>} & AppState & Setters<AppState>) {
  const [greeting, setGreeting] = useState(
    <div className="greeter" style={{textAlign:'center'}} onClick={() => setGreeting(<></>)}>
      <span style={{fontSize: 18, fontStyle: 'italic'}}>
        Welcome to
        <Logo width={250} height="auto" style={{verticalAlign: 'middle'}}/>
      </span>
    </div>);

  useEffect(() => {
    setTimeout(() => {
      setGreeting(<></>);
    }, 2000);
  }, []);

  return <div className="bottom">
    {greeting}
    {/* {props.showFindReplace &&
      <div>
        <FindReplace setCS={props.setEditorState} hide={() => props.setShowFindReplace(false)}/>
      </div>
    } */}
    <div className={"stackHorizontal statusBar" + (props.errors.length ? " error" : "")}>
      <div style={{flexGrow:1}}>
      <PersistentDetailsLocalStorage initiallyOpen={false} localStorageKey="errorsExpanded">
          <summary>{props.errors.length} errors</summary>
          <div style={{maxHeight: '20vh', overflow: 'auto'}}>
          {props.errors.map(({message, shapeUid})=>
            <div>
              {shapeUid}: {message}
            </div>)}
          </div>
        </PersistentDetailsLocalStorage>
      </div>
      <div style={{display: 'flex', alignItems: 'center'}}>
        switch to&nbsp;
        {location.host === "localhost:3000" ?
          <a href={`https://deemz.org/public/statebuddy/${location.hash}`}>production</a>
          : <a href={`http://localhost:3000/${location.hash}`}>development</a>
        }
        &nbsp;mode
      &nbsp;|&nbsp;
        Rev:&nbsp;<a title={"git"} href={`https://deemz.org/git/research/statebuddy/commit/${gitRev}`}>{gitRev.slice(0,8)}</a>
      </div>
    </div>
  </div>;
}
