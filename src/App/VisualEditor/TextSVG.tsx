import { TextDialog } from "@/App/Modals/TextDialog";
import { TraceableError } from "../../statecharts/parser";
import {Text} from "../../statecharts/concrete_syntax";
import { Dispatch, memo, ReactElement, SetStateAction, SVGTextElementAttributes } from "react";
import { jsonDeepEqual } from "@/util/util";

export const FragmentedText = function FragmentedText({start, end, text, highlightClassName, uid, parts, ...rest}: {start: number, end: number, text: string, highlightClassName: string, uid: string, parts: string} & SVGTextElementAttributes<SVGTextElement>) {
  if (start !== -1 && start !== end) {
    return <text data-uid={uid} data-parts={parts} {...rest}>
      {text.slice(0, start)}
      <tspan className={highlightClassName} data-uid={uid} data-parts="text">
        {text.slice(start, end)}
      </tspan>
      {text.slice(end)}
    </text>;
  }
  else {
    return <text data-uid={uid} data-parts={parts} {...rest}>
      {text}
    </text>
  }
}

export const TextSVG = memo(function TextSVG(props: {text: Text, error: TraceableError|undefined, selected: boolean, highlight: boolean, onEdit: (text: Text, newText: string) => void, setModal: Dispatch<SetStateAction<ReactElement|null>>, findText: string}) {

  const className = "draggableText"
    + (props.selected ? " selected":"")
    + (props.highlight ? " highlight":"")
    + (props.error ? " error":"");

  const found = props.text.text.indexOf(props.findText);
  const start = (found >= 0) ? found : -1
  const end = (found >= 0) ? found + props.findText.length : -1;

  const textNode = <FragmentedText
    {...{start, end}}
    text={props.text.text}
    textAnchor="middle"
    className={className}
    highlightClassName="findText"
    uid={props.text.uid}
    parts="text"
    />;

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
      {props.error &&
        <text className="errorHover" y={-20} textAnchor="middle">{props.error.message}</text>
      }
    </g>;
}, (prevProps, newProps) => {
  return jsonDeepEqual(prevProps.text, newProps)
    && prevProps.highlight === newProps.highlight
    && prevProps.onEdit === newProps.onEdit
    && prevProps.setModal === newProps.setModal
    && prevProps.error === newProps.error
    && prevProps.selected === newProps.selected
    && prevProps.findText === newProps.findText
});
