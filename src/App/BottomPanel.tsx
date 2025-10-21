import { useEffect, useState } from "react";
import { TraceableError } from "../statecharts/parser";

import "./BottomPanel.css";

import head from "../head.svg" ;
import { usePersistentState } from "@/util/persistent_state";
import { PersistentDetails } from "./PersistentDetails";

export function BottomPanel(props: {errors: TraceableError[]}) {
  const [greeting, setGreeting] = useState(<><b><img src={head} style={{transform: "scaleX(-1)"}}/>&emsp;"Welcome to StateBuddy, buddy!"</b></>);

  useEffect(() => {
    setTimeout(() => {
      setGreeting(<></>);
    }, 2000);
  }, []);

  return <div className="toolbar bottom">
    <>{greeting}</>
    {props.errors.length > 0 &&
      <div className="errorStatus">
        <PersistentDetails initiallyOpen={false} localStorageKey="errorsExpanded">
          <summary>{props.errors.length} errors</summary>
          {props.errors.map(({message})=>
            <div>
              {message}
            </div>)}
        </PersistentDetails>
      </div>
    }
  </div>;
}