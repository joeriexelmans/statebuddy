import { TextDialog } from "@/App/Modals/TextDialog";
import {getTextFatBBox, Text} from "../../statecharts/concrete_syntax";
import { Dispatch, memo, ReactElement, SetStateAction, useMemo } from "react";
import { jsonDeepEqual } from "@/util/util";
import { BoundingBox } from "./BoundingBox";

import styles from "./VisualEditor.module.css";
import { syntaxHighlight } from "@/statecharts/syntax_higlight";
import { SyntaxHighlightedText, TextWithLineBreaks } from "./SyntaxHiglightedText";

export const TextSVG = memo(function TextSVG(props: {text: Text, selected: boolean, highlight: boolean, onEdit: (text: Text, newText: string) => void, setModal: Dispatch<SetStateAction<ReactElement|null>>, findText: string}) {

  const {
    ranges,
    parseError,
  } = useMemo(() => syntaxHighlight(props.text.text), [props.text.text]);

  const className = styles.draggableText
    + ' ' + (props.selected ? styles.selected : "")
    + ' ' + (props.highlight ? styles.highlight : "")
    + ' ' + (parseError ? styles.error : "");

  const found = props.text.text.indexOf(props.findText);
  const start = (found >= 0) ? found : -1
  const end = (found >= 0) ? found + props.findText.length : -1;

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
      <text
        className={className}
        data-uid={props.text.uid}
        data-parts="text"
      >
        <SyntaxHighlightedText
          text={props.text.text}
          ranges={ranges}
          tspan
          disableTooltips
        />
      </text>

      {/* invisible (unless hovered) helper for selecting and moving the text */}
      <text className={styles.helper + ' ' + styles.draggableText}  data-uid={props.text.uid} data-parts="text" style={{whiteSpace: "preserve"}}>
        <TextWithLineBreaks text={props.text.text}/>
      </text>

      {/* error - only visible on hover */}
      {parseError &&
        <text className={styles.errorHover} y={-20} textAnchor="middle">
          <tspan>{parseError.message}</tspan>
        </text>
      }
    </g></>;
}, (prevProps, newProps) => {
  return jsonDeepEqual(prevProps.text, newProps)
    && prevProps.highlight === newProps.highlight
    && prevProps.onEdit === newProps.onEdit
    && prevProps.setModal === newProps.setModal
    && prevProps.selected === newProps.selected
    && prevProps.findText === newProps.findText
});
