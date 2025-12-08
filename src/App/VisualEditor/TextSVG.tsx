import { TextDialog } from "@/App/Modals/TextDialog";
import { TraceableError } from "../../statecharts/parser";
import {getTextFatBBox, Text} from "../../statecharts/concrete_syntax";
import { Dispatch, memo, ReactElement, SetStateAction, SVGTextElementAttributes } from "react";
import { jsonDeepEqual } from "@/util/util";
import { BoundingBox } from "./BoundingBox";

import styles from "./VisualEditor.module.css";

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

  const className = styles.draggableText
    + ' ' + (props.selected ? styles.selected : "")
    + ' ' + (props.highlight ? styles.highlight : "")
    + ' ' + (props.error ? styles.error : "");

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

  return <>
    <BoundingBox {...getTextFatBBox(props.text)}/>
    <g
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
      <text className={styles.helper} textAnchor="middle" data-uid={props.text.uid} data-parts="text" style={{whiteSpace: "preserve"}}>{props.text.text}</text>
      {props.error &&
        <text className={styles.errorHover} y={-20} textAnchor="middle">{props.error.message}</text>
      }
    </g></>;
}, (prevProps, newProps) => {
  return jsonDeepEqual(prevProps.text, newProps)
    && prevProps.highlight === newProps.highlight
    && prevProps.onEdit === newProps.onEdit
    && prevProps.setModal === newProps.setModal
    && prevProps.error === newProps.error
    && prevProps.selected === newProps.selected
    && prevProps.findText === newProps.findText
});
