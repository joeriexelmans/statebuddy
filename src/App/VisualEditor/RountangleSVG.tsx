import { memo } from "react";
import { Rountangle, RectSide, getRectFatBBox, rountangleMinSize } from "../../statecharts/concrete_syntax";
import { ROUNTANGLE_RADIUS } from "../parameters";
import { RectHelper } from "./RectHelpers";
import { arraysEqual, jsonDeepEqual, setsEqual } from "@/util/util";
import { BoundingBox } from "./BoundingBox";

export const RountangleSVG = memo(function RountangleSVG(props: {rountangle: Rountangle; selected: Set<RectSide>; highlight: RectSide[]; error?: string; active: boolean; }) {
  const { topLeft, size, uid } = props.rountangle;
  // always draw a rountangle with a minimum size
  // during resizing, rountangle can be smaller than this size and even have a negative size, but we don't show it
  const minSize = rountangleMinSize(size);
  const extraAttrs = {
    className: 'rountangle'
      + (props.selected.size === 4 ? " selected" : "")
      + (' ' + props.rountangle.kind)
      + (props.error ? " error" : "")
      + (props.active ? " active" : ""),
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

    <text x={10} y={20} className="uid">{props.rountangle.uid}</text>

    {props.error &&
      <text className="errorHover" x={30} y={20} data-uid={uid} data-parts="left top right bottom">{props.error}</text>}

    <RectHelper uid={uid} size={minSize}
      selected={props.selected}
      highlight={props.highlight} />
  </g>
  <BoundingBox {...getRectFatBBox(props.rountangle)} />
  </>;
}, (prevProps, nextProps) => {
  return prevProps === nextProps ||
       jsonDeepEqual(prevProps.rountangle, nextProps.rountangle)
    && setsEqual(prevProps.selected, nextProps.selected)
    && arraysEqual(prevProps.highlight, nextProps.highlight)
    && prevProps.error === nextProps.error
    && prevProps.active === nextProps.active
})
