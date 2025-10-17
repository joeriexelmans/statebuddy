import { RountanglePart } from "../statecharts/concrete_syntax";
import { Vec2D } from "./geometry";
import { CORNER_HELPER_OFFSET, CORNER_HELPER_RADIUS } from "./parameters";

function lineGeometryProps(size: Vec2D): [RountanglePart, object][] {
  return [
    ["top",    {x1: 0,      y1: 0,      x2: size.x, y2: 0     }],
    ["right",  {x1: size.x, y1: 0,      x2: size.x, y2: size.y}],
    ["bottom", {x1: 0,      y1: size.y, x2: size.x, y2: size.y}],
    ["left",   {x1: 0,      y1: 0,      x2: 0,      y2: size.y}],
  ];
}

export function RectHelper(props: { uid: string, size: Vec2D, selected: string[], highlight: RountanglePart[] }) {
  const geomProps = lineGeometryProps(props.size);
  return <>
    {geomProps.map(([side, ps]) => <>
      {(props.selected.includes(side) || props.highlight.includes(side)) && <line className={""
            + (props.selected.includes(side) ? " selected" : "")
            + (props.highlight.includes(side) ? " highlight" : "")}
            {...ps} data-uid={props.uid} data-parts={side}/>
      }
      <line className="helper" {...ps} data-uid={props.uid} data-parts={side}/>
    </>)}

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
}