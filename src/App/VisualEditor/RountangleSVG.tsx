import { memo } from "react";
import { Rountangle, RectSide, getRectFatBBox, rountangleMinSize } from "../../languages/statecharts/concrete_syntax";
import { EXTRA_HIGHLIGHT_PADDING, ROUNTANGLE_RADIUS } from "../parameters";
import { RectHelper } from "./RectHelpers";
import { arraysEqual, jsonDeepEqual, setsEqual } from "@/util/util";
import { BoundingBox } from "./BoundingBox";
import styles from "./VisualEditor.module.css";
import { DebugUID } from "./DebugUID";
import { Selecting } from "./Selection";

export const RountangleSVG = memo(function RountangleSVG(props: {rountangle: Rountangle; selected: Set<RectSide>; highlight: RectSide[]; error?: string; extraHighlight: boolean, active: boolean; dashed: boolean }) {
  const { topLeft, size, uid } = props.rountangle;
  // always draw a rountangle with a minimum size
  // during resizing, rountangle can be smaller than this size and even have a negative size, but we don't show it
  const bbox = getRectFatBBox(props.rountangle);
  const minSize = rountangleMinSize(size);
  const extraAttrs = {
    className: styles.rountangle
      + ' ' + (props.dashed ? styles.dashed : "")
      + ' ' + (props.selected.size === 4 ? styles.selected : "")
      + ' ' + styles[props.rountangle.kind]
      + ' ' + (props.error ? styles.error : "")
      + ' ' + (props.active ? styles.active : ""),
    "data-uid": uid,
    "data-parts": "left top right bottom",
  };
  return <>
  <g transform={`translate(${topLeft.x} ${topLeft.y})`}>
    <rect
      rx={ROUNTANGLE_RADIUS} ry={ROUNTANGLE_RADIUS}
      x={0}
      y={0}
      width={minSize.x}
      height={minSize.y}
      {...extraAttrs}
    />

    <g transform={`translate(8,16)`}>
      <DebugUID uid={props.rountangle.uid}/>
    </g>

    {props.error &&
      <text className={styles.errorHover} x={30} y={20}>{props.error}</text>}

    <RectHelper uid={uid} size={minSize}
      selected={props.selected}
      highlight={props.highlight}
      dashed={props.dashed} />

  </g>
  {props.extraHighlight && <Selecting {...bbox}/>}
  <BoundingBox {...bbox} />
  </>;
}, (prevProps, nextProps) => {
  return prevProps === nextProps ||
       jsonDeepEqual(prevProps.rountangle, nextProps.rountangle)
    && setsEqual(prevProps.selected, nextProps.selected)
    && arraysEqual(prevProps.highlight, nextProps.highlight)
    && prevProps.error === nextProps.error
    && prevProps.extraHighlight === nextProps.extraHighlight
    && prevProps.active === nextProps.active
    && prevProps.dashed === nextProps.dashed
})
