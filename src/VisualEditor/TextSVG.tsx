import { TraceableError } from "..//statecharts/parser";
import {Text} from "../statecharts/concrete_syntax";

export function TextSVG(props: {text: Text, error: TraceableError|undefined, selected: boolean, highlight: boolean, onEdit: (newText: string) => void}) {
  const commonProps = {
    "data-uid": props.text.uid,
    "data-parts": "text",
    textAnchor: "middle" as "middle",
    className: 
      (props.selected ? "selected":"")
      +(props.highlight ? " highlight":""),
  }

  let textNode;
  if (props.error?.data?.location) {
    const {start,end} = props.error.data.location;
    textNode = <><text {...commonProps}>
      {props.text.text.slice(0, start.offset)}
      <tspan className="error" data-uid={props.text.uid} data-parts="text">
        {props.text.text.slice(start.offset, end.offset)}
        {start.offset === end.offset && <>_</>}
      </tspan>
      {props.text.text.slice(end.offset)}
    </text>
    <text className="error errorHover" y={20} textAnchor="middle">{props.error.message}</text></>;
  }
  else {
    textNode = <text {...commonProps}>{props.text.text}</text>;
  }

  return <g
    key={props.text.uid}
    transform={`translate(${props.text.topLeft.x} ${props.text.topLeft.y})`}
    onDoubleClick={() => {
      const newText = prompt("", props.text.text);
      if (newText) {
        props.onEdit(newText);
      }
    }}
  >{textNode}</g>;
}