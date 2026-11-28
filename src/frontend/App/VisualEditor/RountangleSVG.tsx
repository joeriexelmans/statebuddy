import { memo } from "react";
import { Rountangle, RectSide, getRectFatBBox, rectMinimumSize } from "../../../languages/statecharts/concrete_syntax";
import { EXTRA_HIGHLIGHT_PADDING, ROUNTANGLE_RADIUS } from "../parameters";
import { RectHelper } from "./RectHelpers";
import { jsonDeepEqual } from "@/util/is_equal";
import { arraysEqual, setsEqual } from "@/util/is_equal";
import { BoundingBox } from "./BoundingBox";
import styles from "./VisualEditor.module.css";
import { DebugUID } from "./DebugUID";
import { Selecting } from "./Selection";
import { normalizeRect } from "@/util/geometry";

export const RountangleSVG = memo(function RountangleSVG(props: {rountangle: Rountangle; selected: Set<RectSide>; highlight: RectSide[]; error?: string; extraHighlight: boolean, active: boolean; dashed: boolean }) {
  const { uid } = props.rountangle;
  // always draw a rountangle with a minimum size (otherwise it becomes difficult for the user to see what she has drawn)
  // during resizing, rountangle can be secretely smaller than this size, but we don't render it that way:
  const minSize = rectMinimumSize(props.rountangle); // <-- possibly negative size in any dimension(s)

  const bbox = getRectFatBBox(minSize);

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
  <g transform={`translate(${minSize.topLeft.x} ${minSize.topLeft.y})`}>
    <rect
      rx={ROUNTANGLE_RADIUS} ry={ROUNTANGLE_RADIUS}
      x={0}
      y={0}
      width={minSize.size.x}
      height={minSize.size.y}
      {...extraAttrs}
    />

    <g transform={`translate(8,16)`}>
      <DebugUID uid={props.rountangle.uid}/>
    </g>

    {props.error &&
      <text className={styles.errorHover} x={30} y={20}>{props.error}</text>}

    <RectHelper uid={uid} size={minSize.size}
      selected={props.selected}
      highlight={props.highlight}
      dashed={props.dashed} />

  </g>
  {/* <g transform={`translate(${minSize.topLeft.x} ${minSize.topLeft.y})`}>
  </g> */}
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
