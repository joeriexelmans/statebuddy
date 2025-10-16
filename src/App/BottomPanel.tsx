import { TraceableError } from "../statecharts/parser";

import "./BottomPanel.css";

export function BottomPanel(props: {errors: TraceableError[]}) {
  return <div className="toolbar">
    <div className="errorStatus">{
      props.errors.length>0 && <>{props.errors.length} errors {props.errors.map(({message})=>message).join(',')}</>}</div>
  </div>;
}