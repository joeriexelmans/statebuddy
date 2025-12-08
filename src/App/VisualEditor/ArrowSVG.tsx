import { memo } from "react";
import { Arrow, ArrowPart, getArrowFatBBox, getArrowFatBBoxes } from "../../statecharts/concrete_syntax";
import { ArcDirection, euclideanDistance } from "../../util/geometry";
import { CORNER_HELPER_RADIUS } from "../parameters";
import { arraysEqual, jsonDeepEqual, setsEqual } from "@/util/util";
import { BoundingBox } from "./BoundingBox";
import styles from "./VisualEditor.module.css";

export const ArrowSVG = memo(function(props: { arrow: Arrow; selected: Set<ArrowPart>; error: string; highlight: boolean; fired: boolean; arc: ArcDirection; initialMarker: boolean }) {
  const { start, end, uid } = props.arrow;
  const radius = euclideanDistance(start, end) / 1.6;
  let largeArc = "1";
  let arcOrLine = props.arc === "no" ? "L" :
    `A ${radius} ${radius} 0 ${largeArc} ${props.arc === "ccw" ? "0" : "1"}`;
  if (props.initialMarker) {
    // largeArc = "0";
    arcOrLine = `A ${radius*2} ${radius*2} 0 0 1`
  }
  const [startBBox, endBBox] = getArrowFatBBoxes(props.arrow);
  const bbox = getArrowFatBBox(props.arrow);
  return <g>
    <BoundingBox {...startBBox} />
    <BoundingBox {...endBBox} />
    <BoundingBox {...bbox} />
    <path
      className={styles.arrow
        + ' ' + (props.selected.size === 2 ? styles.selected : "")
        + ' ' + (props.error ? styles.error : "")
        + ' ' + (props.highlight ? styles.highlight : "")
        + ' ' + (props.fired ? styles.fired : "")
      }
      markerStart={props.initialMarker ? 'url(#initialMarker)' : undefined}
      markerEnd='url(#arrowEnd)'
      d={`M ${start.x} ${start.y}
            ${arcOrLine}
            ${end.x} ${end.y}`}
      data-uid={uid}
      data-parts="start end" />

    {props.error && <text
      className={styles.errorHover}
      x={(start.x + end.x) / 2 + 5}
      y={(start.y + end.y) / 2}
      textAnchor="middle"
      >{props.error}</text>}

    <path
      className={styles.helper}
      d={`M ${start.x} ${start.y}
            ${arcOrLine}
            ${end.x} ${end.y}`}
      data-uid={uid}
      data-parts="start end" />

    {/* selection helper circles */}
    <circle
      className={styles.helper}
      cx={start.x}
      cy={start.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="start" />
    <circle
      className={styles.helper}
      cx={end.x}
      cy={end.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="end" />

    {/* selection indicator circles */}
    {props.selected.has("start") && <circle
      className={styles.selected}
      cx={start.x}
      cy={start.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="start" />}
    {props.selected.has("end") && <circle
      className={styles.selected}
      cx={end.x}
      cy={end.y}
      r={CORNER_HELPER_RADIUS}
      data-uid={uid}
      data-parts="end" />}

  </g>;
}, (prevProps, nextProps) => {
  return jsonDeepEqual(prevProps.arrow, nextProps.arrow)
    && setsEqual(prevProps.selected, nextProps.selected)
    && prevProps.highlight === nextProps.highlight
    && prevProps.error === nextProps.error
    && prevProps.fired === nextProps.fired
    && prevProps.arc === nextProps.arc
    && prevProps.initialMarker === nextProps.initialMarker
})
