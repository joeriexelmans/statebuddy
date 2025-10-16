import { Arrow } from "../statecharts/concrete_syntax";
import { ArcDirection, euclideanDistance } from "./geometry";
import { CORNER_HELPER_RADIUS } from "./parameters";


export function ArrowSVG(props: { arrow: Arrow; selected: string[]; errors: string[]; highlight: boolean; arc: ArcDirection; }) {
  const { start, end, uid } = props.arrow;
  const radius = euclideanDistance(start, end) / 1.6;
  const largeArc = "1";
  const arcOrLine = props.arc === "no" ? "L" :
    `A ${radius} ${radius} 0 ${largeArc} ${props.arc === "ccw" ? "0" : "1"}`;
  return <g>
    <path
      className={"arrow"
        + (props.selected.length === 2 ? " selected" : "")
        + (props.errors.length > 0 ? " error" : "")
        + (props.highlight ? " highlight" : "")}
      markerEnd='url(#arrowEnd)'
      d={`M ${start.x} ${start.y}
            ${arcOrLine}
            ${end.x} ${end.y}`}
      data-uid={uid}
      data-parts="start end" />

    {props.errors.length > 0 && <text
      className="error"
      x={(start.x + end.x) / 2 + 5}
      y={(start.y + end.y) / 2}
      textAnchor="middle"
      data-uid={uid}
      data-parts="start end">{props.errors.join(' ')}</text>}

    <path
      className="pathHelper"
      d={`M ${start.x} ${start.y}
            ${arcOrLine}
            ${end.x} ${end.y}`}
      data-uid={uid}
      data-parts="start end" />

    <circle
      className={"circleHelper"
        + (props.selected.includes("start") ? " selected" : "")}
      cx={start.x}
      cy={start.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="start" />
    <circle
      className={"circleHelper"
        + (props.selected.includes("end") ? " selected" : "")}
      cx={end.x}
      cy={end.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="end" />
  </g>;
}
