import { Diamond, RountanglePart } from "@/statecharts/concrete_syntax";
import { rountangleMinSize } from "./VisualEditor";
import { Vec2D } from "./geometry";
import { RectHelper } from "./RectHelpers";
import { memo } from "react";

export const DiamondShape = memo(function DiamondShape(props: {size: Vec2D, extraAttrs: object}) {
  const minSize = rountangleMinSize(props.size);
  return <polygon
    points={`
      ${minSize.x/2} ${0},
      ${minSize.x}   ${minSize.y/2},
      ${minSize.x/2} ${minSize.y},
      ${0}           ${minSize.y/2}
    `}
    fill="white"
    stroke="black"
    strokeWidth={2}
    {...props.extraAttrs}
  />;
});

export const DiamondSVG = memo(function DiamondSVG(props: { diamond: Diamond; selected: string[]; highlight: RountanglePart[]; errors: string[]; active: boolean; }) {
  const minSize = rountangleMinSize(props.diamond.size);
  const extraAttrs = {
    className: ''
      + (props.selected.length === 4 ? " selected" : "")
      + (props.errors.length > 0 ? " error" : "")
      + (props.active ? " active" : ""),
    "data-uid": props.diamond.uid,
    "data-parts": "left top right bottom",
  };
  return <g transform={`translate(${props.diamond.topLeft.x} ${props.diamond.topLeft.y})`}>
    <DiamondShape size={minSize} extraAttrs={extraAttrs}/>

    <text x={minSize.x/2} y={minSize.y/2}
      className="uid"
      textAnchor="middle">{props.diamond.uid}</text>

    <RectHelper uid={props.diamond.uid} size={minSize} highlight={props.highlight} selected={props.selected} />
  </g>;
});
