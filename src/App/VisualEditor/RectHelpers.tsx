import { memo } from "react";
import { RectSide } from "../../statecharts/concrete_syntax";
import { Vec2D } from "../../util/geometry";
import { CORNER_HELPER_OFFSET, CORNER_HELPER_RADIUS } from "../parameters";
import { arraysEqual, objectsEqual, setsEqual } from "@/util/util";

function lineGeometryProps(size: Vec2D): [RectSide, object][] {
  return [
    ["top",    {x1: 0,      y1: 0,      x2: size.x, y2: 0     }],
    ["right",  {x1: size.x, y1: 0,      x2: size.x, y2: size.y}],
    ["bottom", {x1: 0,      y1: size.y, x2: size.x, y2: size.y}],
    ["left",   {x1: 0,      y1: 0,      x2: 0,      y2: size.y}],
  ];
}

// no need to memo() this component, the parent component is already memoized
export const RectHelper = memo(function RectHelper(props: { uid: string, size: Vec2D, selected: Set<RectSide>, highlight: string[] }) {
  const geomProps = lineGeometryProps(props.size);
  return <>
    {geomProps.map(([side, ps]) => <g key={side}>
      {(props.selected.has(side) || props.highlight.includes(side)) && <line className={""
            + (props.selected.has(side) ? " selected" : "")
            + (props.highlight.includes(side) ? " highlight" : "")}
            {...ps} data-uid={props.uid} data-parts={side}/>
      }
      <line className="helper" {...ps} data-uid={props.uid} data-parts={side}/>
    </g>)}

    {/* The corner-helpers have the DOM class 'corner' added to them, because we ignore them when the user is making a selection. Only if the user clicks directly on them, do we select their respective parts. */}
    <circle
      className="helper corner"
      cx={CORNER_HELPER_OFFSET}
      cy={CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={props.uid}
      data-parts="top left" />
    <circle
      className="helper corner"
      cx={props.size.x - CORNER_HELPER_OFFSET}
      cy={CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={props.uid}
      data-parts="top right" />
    <circle
      className="helper corner"
      cx={props.size.x - CORNER_HELPER_OFFSET}
      cy={props.size.y - CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={props.uid}
      data-parts="bottom right" />
    <circle
      className="helper corner"
      cx={CORNER_HELPER_OFFSET}
      cy={props.size.y - CORNER_HELPER_OFFSET}
      r={CORNER_HELPER_RADIUS}
      data-uid={props.uid}
      data-parts="bottom left" />
  </>;
}, (prevProps, nextProps) => {
  return prevProps.uid === nextProps.uid
    && objectsEqual(prevProps.size, nextProps.size)
    && setsEqual(prevProps.selected, nextProps.selected)
    && arraysEqual(prevProps.highlight, nextProps.highlight)
});