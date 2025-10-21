import { useEffect, useState } from "react";
import { TraceableError } from "../statecharts/parser";

import "./BottomPanel.css";

import head from "../head.svg" ;
import { usePersistentState } from "@/util/persistent_state";
import { PersistentDetails } from "./PersistentDetails";
import { DigitalWatch } from "@/Plant/DigitalWatch/DigitalWatch";

export function BottomPanel(props: {errors: TraceableError[]}) {
  const [greeting, setGreeting] = useState(<><b><img src={head} style={{transform: "scaleX(-1)"}}/>&emsp;"Welcome to StateBuddy, buddy!"</b><br/></>);

  useEffect(() => {
    setTimeout(() => {
      setGreeting(<></>);
    }, 2000);
  }, []);

  return <div className="toolbar bottom">
    {greeting}
    <DigitalWatch alarm={true} light={true}  h={12} m={30} s={33}/>
    {props.errors.length > 0 &&
      <div className="errorStatus">
        <PersistentDetails initiallyOpen={false} localStorageKey="errorsExpanded">
          <summary>{props.errors.length} errors</summary>
          <div style={{maxHeight: '25vh', overflow: 'auto'}}>
          {props.errors.map(({message, shapeUid})=>
            <div>
              {shapeUid}: {message}
            </div>)}
          </div>
        </PersistentDetails>
      </div>
    }
  </div>;
}