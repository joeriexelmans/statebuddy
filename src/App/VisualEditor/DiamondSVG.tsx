import { Diamond, rectMinimumSize, RectSide } from "@/languages/statecharts/concrete_syntax";
import { normalizeRect, Vec2D } from "../../util/geometry";
import { RectHelper } from "./RectHelpers";
import { memo } from "react";
import { arraysEqual, jsonDeepEqual, setsEqual } from "@/util/util";
import styles from "./VisualEditor.module.css"
import { BoundingBox } from "./BoundingBox";
import { DebugUID } from "./DebugUID";

export const DiamondShape = memo(function DiamondShape(props: {size: Vec2D, extraAttrs: object}) {
  return <polygon
    points={`
      ${props.size.x/2} ${0},
      ${props.size.x}   ${props.size.y/2},
      ${props.size.x/2} ${props.size.y},
      ${0}              ${props.size.y/2}
    `}
    style={{}}
    stroke="black"
    strokeWidth={2}
    {...props.extraAttrs}
  />;
});

export const DiamondSVG = memo(function DiamondSVG(props: { diamond: Diamond; selected: Set<RectSide>; highlight: RectSide[]; error?: string; active: boolean; }) {
  // See RountangleSVG for explanation of minSize and normalized.
  const minSize = rectMinimumSize(props.diamond);

  const extraAttrs = {
    className: styles.diamond
      + ' ' + (props.selected.size === 4 ? styles.selected : "")
      + ' ' + (props.error ? styles.error : "")
      + ' ' + (props.active ? styles.active : ""),
    "data-uid": props.diamond.uid,
    "data-parts": "left top right bottom",
  };
  return <>
    <g transform={`translate(${minSize.topLeft.x} ${minSize.topLeft.y})`}>
      <DiamondShape size={minSize.size} extraAttrs={extraAttrs}/>

      <g transform={`translate(${minSize.size.x/2} ${minSize.size.y/2})`}>
        <DebugUID uid={props.diamond.uid}/>
      </g>
      
      {props.error && <text className="errorHover" x={minSize.size.x/2} y={minSize.size.y/2 - 20} textAnchor="middle">{props.error}</text>}
      <RectHelper uid={props.diamond.uid} size={minSize.size} highlight={props.highlight} selected={props.selected} dashed={false} />
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
