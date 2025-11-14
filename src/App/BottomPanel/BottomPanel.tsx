import { useEffect, useState } from "react";
import { TraceableError } from "../../statecharts/parser";

import "./BottomPanel.css";

import { PersistentDetailsLocalStorage } from "../PersistentDetails";
import { Logo } from "@/App/Logo/Logo";

export function BottomPanel(props: {errors: TraceableError[]}) {
  const [greeting, setGreeting] = useState(
    <div style={{textAlign:'center'}}>
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
    {greeting}
    {props.errors.length > 0 &&
      <div className="errorStatus">
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
    }
  </div>;
}