import { Dispatch, useEffect, useState } from "react";
import { TraceableError } from "../../statecharts/parser";

import "./BottomPanel.css";

import { PersistentDetailsLocalStorage } from "../Components/PersistentDetails";
import { Logo } from "@/App/Logo/Logo";
import { AppState } from "../App";
import { FindReplace } from "./FindReplace";
import { VisualEditorState } from "../VisualEditor/VisualEditor";
import { Setters } from "../makePartialSetter";

import gitRev from "@/git-rev.txt";

export function BottomPanel(props: {errors: TraceableError[], setEditorState: Dispatch<(state: VisualEditorState) => VisualEditorState>} & AppState & Setters<AppState>) {
  const [greeting, setGreeting] = useState(
    <div className="greeter" style={{textAlign:'center'}}>
      <span style={{fontSize: 18, fontStyle: 'italic'}}>
        Welcome to <Logo/>
      </span>
    </div>);

  useEffect(() => {
    setTimeout(() => {
      setGreeting(<></>);
    }, 2000);
  }, []);

  return <div className="toolbar bottom">
    {/* {props.showFindReplace &&
      <div>
        <FindReplace setCS={props.setEditorState} hide={() => props.setShowFindReplace(false)}/>
      </div>
    } */}
    <div className={"statusBar" + props.errors.length ? " error" : ""}>
      <PersistentDetailsLocalStorage initiallyOpen={false} localStorageKey="errorsExpanded">
        <summary>{props.errors.length} errors</summary>
        <div style={{maxHeight: '25vh', overflow: 'auto'}}>
        {props.errors.map(({message, shapeUid})=>
          <div>
            {shapeUid}: {message}
          </div>)}
        </div>
      </PersistentDetailsLocalStorage>
    </div>
    {greeting}
  </div>;
}
