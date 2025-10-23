import { TextDialog } from "@/App/TextDialog";
import { TraceableError } from "..//statecharts/parser";
import {Text} from "../statecharts/concrete_syntax";
import { Dispatch, memo, ReactElement, SetStateAction } from "react";

export const TextSVG = memo(function TextSVG(props: {text: Text, error: TraceableError|undefined, selected: boolean, highlight: boolean, onEdit: (text: Text, newText: string) => void, setModal: Dispatch<SetStateAction<ReactElement|null>>}) {
  const commonProps = {
    "data-uid": props.text.uid,
    "data-parts": "text",
    textAnchor: "middle" as "middle",
    className: "draggableText"
      + (props.selected ? " selected":"")
      + (props.highlight ? " highlight":""),
    style: {whiteSpace: "preserve"},
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
      props.setModal(<TextDialog setModal={props.setModal} text={props.text.text} done={newText => {
          if (newText) {
            props.onEdit(props.text, newText);
          }
      }} />)
    }}>
      {textNode}
      <text className="draggableText helper" textAnchor="middle" data-uid={props.text.uid} data-parts="text" style={{whiteSpace: "preserve"}}>{props.text.text}</text>
    </g>;
});
