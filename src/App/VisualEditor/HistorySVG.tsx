import { memo } from "react";
import { Vec2D } from "../../util/geometry";
import { HISTORY_RADIUS } from "../parameters";
import { BoundingBox } from "./BoundingBox";
import { getHistoryFatBBox } from "@/statecharts/concrete_syntax";
import styles from "./VisualEditor.module.css";

export const HistorySVG = memo(function HistorySVG(props: {uid: string, topLeft: Vec2D, kind: "shallow"|"deep", selected: boolean, highlight: boolean}) {
  const text = props.kind === "shallow" ? "H" : "H*";
  return <>
    <BoundingBox {...getHistoryFatBBox(props)}/>
    <circle
      cx={props.topLeft.x+HISTORY_RADIUS}
      cy={props.topLeft.y+HISTORY_RADIUS}
      r={HISTORY_RADIUS}
      style={{
        fill: 'var(--and-state-bg-color)',
        stroke: 'var(--rountangle-stroke-color)'
      }}
      strokeWidth={2}
      data-uid={props.uid}
      data-parts="history"
    />
    <text
      x={props.topLeft.x+HISTORY_RADIUS}
      y={props.topLeft.y+HISTORY_RADIUS+5}
      textAnchor="middle"
      fontWeight={500}
      style={{fill: 'var(--rountangle-stroke-color)'}}
      >{text}</text>
    <circle
      className={styles.helper}
      cx={props.topLeft.x+HISTORY_RADIUS}
      cy={props.topLeft.y+HISTORY_RADIUS}
      r={HISTORY_RADIUS}
      data-uid={props.uid}
      data-parts="history"
    />
    {(props.selected || props.highlight) &&
      <circle
        className={props.selected ? styles.selected : props.highlight ? styles.highlight : ""}
        cx={props.topLeft.x+HISTORY_RADIUS}
        cy={props.topLeft.y+HISTORY_RADIUS}
        r={HISTORY_RADIUS}
        data-uid={props.uid}
        data-parts="history"
      />}
  </>;
});
