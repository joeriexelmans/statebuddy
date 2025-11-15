import { memo } from "react";
import { Arrow, ArrowPart } from "../../statecharts/concrete_syntax";
import { ArcDirection, euclideanDistance } from "../../util/geometry";
import { CORNER_HELPER_RADIUS } from "../parameters";
import { arraysEqual, jsonDeepEqual } from "@/util/util";


export const ArrowSVG = memo(function(props: { arrow: Arrow; selected: ArrowPart[]; error: string; highlight: boolean; fired: boolean; arc: ArcDirection; initialMarker: boolean }) {
  const { start, end, uid } = props.arrow;
  const radius = euclideanDistance(start, end) / 1.6;
  let largeArc = "1";
  let arcOrLine = props.arc === "no" ? "L" :
    `A ${radius} ${radius} 0 ${largeArc} ${props.arc === "ccw" ? "0" : "1"}`;
  if (props.initialMarker) {
    // largeArc = "0";
    arcOrLine = `A ${radius*2} ${radius*2} 0 0 1`
  }
  return <g>
    <path
      className={"arrow"
        + (props.selected.length === 2 ? " selected" : "")
        + (props.error ? " error" : "")
        + (props.highlight ? " highlight" : "")
        + (props.fired ? " fired" : "")
      }
      markerStart={props.initialMarker ? 'url(#initialMarker)' : undefined}
      markerEnd='url(#arrowEnd)'
      d={`M ${start.x} ${start.y}
            ${arcOrLine}
            ${end.x} ${end.y}`}
      data-uid={uid}
      data-parts="start end" />

    {props.error && <text
      className="errorHover"
      x={(start.x + end.x) / 2 + 5}
      y={(start.y + end.y) / 2}
      textAnchor="middle"
      data-uid={uid}
      data-parts="start end">{props.error}</text>}

    <path
      className="helper"
      d={`M ${start.x} ${start.y}
            ${arcOrLine}
            ${end.x} ${end.y}`}
      data-uid={uid}
      data-parts="start end" />

    {/* selection helper circles */}
    <circle
      className="helper"
      cx={start.x}
      cy={start.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="start" />
    <circle
      className="helper"
      cx={end.x}
      cy={end.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="end" />

    {/* selection indicator circles */}
    {props.selected.includes("start") && <circle
      className="selected"
      cx={start.x}
      cy={start.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="start" />}
    {props.selected.includes("end") && <circle
      className="selected"
      cx={end.x}
      cy={end.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="end" />}

  </g>;
}, (prevProps, nextProps) => {
  return jsonDeepEqual(prevProps.arrow, nextProps.arrow)
    && arraysEqual(prevProps.selected, nextProps.selected)
    && prevProps.highlight === nextProps.highlight
    && prevProps.error === nextProps.error
    && prevProps.fired === nextProps.fired
    && prevProps.arc === nextProps.arc
    && prevProps.initialMarker === nextProps.initialMarker
})
