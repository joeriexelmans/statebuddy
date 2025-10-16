import { RountanglePart } from "../statecharts/concrete_syntax";
import { Vec2D } from "./geometry";
import { CORNER_HELPER_OFFSET, CORNER_HELPER_RADIUS } from "./parameters";

export function RectHelper(props: { uid: string, size: Vec2D, selected: string[], highlight: RountanglePart[] }) {
  return <>
    <line
      className={"lineHelper"
        + (props.selected.includes("top") ? " selected" : "")
        + (props.highlight.includes("top") ? " highlight" : "")}
      x1={0}
      y1={0}
      x2={props.size.x}
      y2={0}
      data-uid={props.uid}
      data-parts="top" />
    <line
      className={"lineHelper"
        + (props.selected.includes("right") ? " selected" : "")
        + (props.highlight.includes("right") ? " highlight" : "")}
      x1={props.size.x}
      y1={0}
      x2={props.size.x}
      y2={props.size.y}
      data-uid={props.uid}
      data-parts="right" />
    <line
      className={"lineHelper"
        + (props.selected.includes("bottom") ? " selected" : "")
        + (props.highlight.includes("bottom") ? " highlight" : "")}
      x1={0}
      y1={props.size.y}
      x2={props.size.x}
      y2={props.size.y}
      data-uid={props.uid}
      data-parts="bottom" />
    <line
      className={"lineHelper"
        + (props.selected.includes("left") ? " selected" : "")
        + (props.highlight.includes("left") ? " highlight" : "")}
      x1={0}
      y1={0}
      x2={0}
      y2={props.size.y}
      data-uid={props.uid}
      data-parts="left" />

    <circle
      className="circleHelper corner"
      cx={CORNER_HELPER_OFFSET}
      cy={CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={props.uid}
      data-parts="top left" />
    <circle
      className="circleHelper corner"
      cx={props.size.x - CORNER_HELPER_OFFSET}
      cy={CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={props.uid}
      data-parts="top right" />
    <circle
      className="circleHelper corner"
      cx={props.size.x - CORNER_HELPER_OFFSET}
      cy={props.size.y - CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={props.uid}
      data-parts="bottom right" />
    <circle
      className="circleHelper corner"
      cx={CORNER_HELPER_OFFSET}
      cy={props.size.y - CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={props.uid}
      data-parts="bottom left" />
  </>;
}