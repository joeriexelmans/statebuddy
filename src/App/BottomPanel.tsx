import { useEffect, useState } from "react";
import { TraceableError } from "../statecharts/parser";

import "./BottomPanel.css";

import head from "../head.svg" ;

export function BottomPanel(props: {errors: TraceableError[]}) {
  const [greeting, setGreeting] = useState(<b><img src={head}/>&emsp;"Welcome to StateBuddy, buddy!"</b>);

  useEffect(() => {
    setTimeout(() => {
      setGreeting("");
    }, 2000);
  }, []);

  return <div className="toolbar bottom">
    <>{greeting}</>
    {props.errors.length > 0 &&
      <div className="errorStatus">
        {props.errors.length>0 && <>{props.errors.length} errors: {props.errors.map(({message})=>message).join(', ')}</>}
      </div>}
  </div>;
}