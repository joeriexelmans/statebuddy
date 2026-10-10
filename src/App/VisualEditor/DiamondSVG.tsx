import { Diamond, RectSide } from "@/statecharts/concrete_syntax";
import { rountangleMinSize } from "@/statecharts/concrete_syntax";
import { Vec2D } from "../../util/geometry";
import { RectHelper } from "./RectHelpers";
import { memo } from "react";
import { arraysEqual, jsonDeepEqual, mapsEqual, setsEqual } from "@/util/util";
import styles from "./VisualEditor.module.css"
import { BoundingBox } from "./BoundingBox";
import { DebugUID } from "./DebugUID";

export const DiamondShape = memo(function DiamondShape(props: {size: Vec2D, extraAttrs: object}) {
  const minSize = rountangleMinSize(props.size);
  return <polygon
    points={`
      ${minSize.x/2} ${0},
      ${minSize.x}   ${minSize.y/2},
      ${minSize.x/2} ${minSize.y},
      ${0}           ${minSize.y/2}
    `}
    style={{}}
    stroke="black"
    strokeWidth={2}
    {...props.extraAttrs}
  />;
});

export const DiamondSVG = memo(function DiamondSVG(props: { diamond: Diamond; selected: Set<RectSide>; highlight: RectSide[]; error?: string; active: boolean; }) {
  const minSize = rountangleMinSize(props.diamond.size);
  const extraAttrs = {
    className: styles.diamond
      + ' ' + (props.selected.size === 4 ? styles.selected : "")
      + ' ' + (props.error ? styles.error : "")
      + ' ' + (props.active ? styles.active : ""),
    "data-uid": props.diamond.uid,
    "data-parts": "left top right bottom",
  };
  return <>
    <g transform={`translate(${props.diamond.topLeft.x} ${props.diamond.topLeft.y})`}>
      <DiamondShape size={minSize} extraAttrs={extraAttrs}/>

      <g transform={`translate(${props.diamond.size.x/2} ${props.diamond.size.y/2})`}>
        <DebugUID uid={props.diamond.uid}/>
      </g>
      
      {props.error && <text className="errorHover" x={minSize.x/2} y={minSize.y/2 - 20} textAnchor="middle">{props.error}</text>}

      <RectHelper uid={props.diamond.uid} size={minSize} highlight={props.highlight} selected={props.selected} dashed={false} />
    </g>
    <BoundingBox {...props.diamond}/>
  </>
;
}, (prevProps, nextProps) => {
  return jsonDeepEqual(prevProps.diamond, nextProps.diamond)
    && setsEqual(prevProps.selected, nextProps.selected)
    && arraysEqual(prevProps.highlight, nextProps.highlight)
    && prevProps.error === nextProps.error
    && prevProps.active === nextProps.active
});
