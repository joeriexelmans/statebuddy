import { Vec2D } from "./geometry";
import { HISTORY_RADIUS } from "./parameters";

export function HistorySVG(props: {uid: string, topLeft: Vec2D, kind: "shallow"|"deep", selected: boolean, highlight: boolean}) {
  const text = props.kind === "shallow" ? "H" : "H*";
  return <>
    <circle
      cx={props.topLeft.x+HISTORY_RADIUS}
      cy={props.topLeft.y+HISTORY_RADIUS}
      r={HISTORY_RADIUS}
      fill="white"
      stroke="black"
      strokeWidth={2}
      data-uid={props.uid}
      data-parts="history"
    />
    <text
      x={props.topLeft.x+HISTORY_RADIUS}
      y={props.topLeft.y+HISTORY_RADIUS+5}
      textAnchor="middle"
      fontWeight={500}
      >{text}</text>
    <circle
      className="helper"
      cx={props.topLeft.x+HISTORY_RADIUS}
      cy={props.topLeft.y+HISTORY_RADIUS}
      r={HISTORY_RADIUS}
      data-uid={props.uid}
      data-parts="history"
    />
    {(props.selected || props.highlight) &&
      <circle
        className={props.selected ? "selected" : props.highlight ? "highlight" : ""}
        cx={props.topLeft.x+HISTORY_RADIUS}
        cy={props.topLeft.y+HISTORY_RADIUS}
        r={HISTORY_RADIUS}
        data-uid={props.uid}
        data-parts="history"
      />}
  </>;
}
