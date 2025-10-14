import { Rountangle, RountanglePart } from "../statecharts/concrete_syntax";
import { Rect2D } from "./geometry";
import { ROUNTANGLE_RADIUS, CORNER_HELPER_OFFSET, CORNER_HELPER_RADIUS } from "./parameters";
import { rountangleMinSize } from "./VisualEditor";

export function DiamondShape(props: {geometry: Rect2D, extraAttrs: object}) {
  const {geometry} = props;
  return <polygon
    points={`
      ${geometry.size.x/2} ${0},
      ${geometry.size.x}   ${geometry.size.y/2},
      ${geometry.size.x/2} ${geometry.size.y},
      ${0}                 ${geometry.size.y/2}
    `}
    {...props.extraAttrs}
  />;
}

export function RountangleSVG(props: { rountangle: Rountangle; selected: string[]; highlight: RountanglePart[]; errors: string[]; active: boolean; }) {
  const { topLeft, size, uid } = props.rountangle;
  // always draw a rountangle with a minimum size
  // during resizing, rountangle can be smaller than this size and even have a negative size, but we don't show it
  const minSize = rountangleMinSize(size);
  const extraAttrs = {
    className: 'rountangle'
      + (props.selected.length === 4 ? " selected" : "")
      + (' ' + props.rountangle.kind)
      + (props.errors.length > 0 ? " error" : "")
      + (props.active ? " active" : ""),
    "data-uid": uid,
    "data-parts": "left top right bottom",
  };
  return <g transform={`translate(${topLeft.x} ${topLeft.y})`}>
    {props.rountangle.kind === "pseudo" ?
        <DiamondShape geometry={props.rountangle} extraAttrs={extraAttrs}/>
      : <rect
        rx={ROUNTANGLE_RADIUS} ry={ROUNTANGLE_RADIUS}
        x={0}
        y={0}
        width={minSize.x}
        height={minSize.y}
        {...extraAttrs}
      />
    }
    

    {(props.errors.length > 0) &&
      <text className="error" x={10} y={40} data-uid={uid} data-parts="left top right bottom">{props.errors.join(' ')}</text>}


    <line
      className={"lineHelper"
        + (props.selected.includes("top") ? " selected" : "")
        + (props.highlight.includes("top") ? " highlight" : "")}
      x1={0}
      y1={0}
      x2={minSize.x}
      y2={0}
      data-uid={uid}
      data-parts="top" />
    <line
      className={"lineHelper"
        + (props.selected.includes("right") ? " selected" : "")
        + (props.highlight.includes("right") ? " highlight" : "")}
      x1={minSize.x}
      y1={0}
      x2={minSize.x}
      y2={minSize.y}
      data-uid={uid}
      data-parts="right" />
    <line
      className={"lineHelper"
        + (props.selected.includes("bottom") ? " selected" : "")
        + (props.highlight.includes("bottom") ? " highlight" : "")}
      x1={0}
      y1={minSize.y}
      x2={minSize.x}
      y2={minSize.y}
      data-uid={uid}
      data-parts="bottom" />
    <line
      className={"lineHelper"
        + (props.selected.includes("left") ? " selected" : "")
        + (props.highlight.includes("left") ? " highlight" : "")}
      x1={0}
      y1={0}
      x2={0}
      y2={minSize.y}
      data-uid={uid}
      data-parts="left" />

    <circle
      className="circleHelper corner"
      cx={CORNER_HELPER_OFFSET}
      cy={CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="top left" />
    <circle
      className="circleHelper corner"
      cx={minSize.x - CORNER_HELPER_OFFSET}
      cy={CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="top right" />
    <circle
      className="circleHelper corner"
      cx={minSize.x - CORNER_HELPER_OFFSET}
      cy={minSize.y - CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="bottom right" />
    <circle
      className="circleHelper corner"
      cx={CORNER_HELPER_OFFSET}
      cy={minSize.y - CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="bottom left" />
    <text x={10} y={20}
      className="uid"
      data-uid={uid}>{uid}</text>
  </g>;
}
