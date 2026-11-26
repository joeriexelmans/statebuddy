import { ToolMode, ToolSelectState } from "@/App/migrations/v1_types";
import { useShortcuts } from "@/hooks/useShortcuts";
import HighlightAltSharpIcon from '@mui/icons-material/HighlightAltSharp';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { memo, ReactElement } from "react";
import { Tooltip } from "../../../Components/Tooltip";
import { TwoStateButton } from "../../../Components/TwoStateButton";
import { Setters, DeepSetter } from "../../../../util/partial_setter";
import { RountangleIcon, PseudoStateIcon, HistoryIcon } from "../../Icons";
import { KeyInfoVisible, KeyInfoHidden } from "../../KeyInfo";
import { MouseIcon } from "../../MouseIcon";

import PanToolIcon from '@mui/icons-material/PanTool';
import ControlCameraIcon from '@mui/icons-material/ControlCamera';

const insertModes: [ToolMode, string, ReactElement, ReactElement][] = [
  ["select", "select, move, resize", <HighlightAltSharpIcon fontSize="small"/>, <kbd>S</kbd>],
  ["pan", "pan view", <ControlCameraIcon fontSize="small"/>, <kbd>Q</kbd>],
  ["and", "draw AND-state", <RountangleIcon kind="and" dashed={false}/>, <kbd>A</kbd>],
  ["or", "draw OR-state", <RountangleIcon kind="or" dashed={true}/>, <kbd>R</kbd>],
  ["pseudo", "draw choice-state", <PseudoStateIcon/>, <kbd>C</kbd>],
  ["shallow", "draw shallow history", <HistoryIcon kind="shallow"/>, <kbd>H</kbd>],
  ["deep", "draw deep history", <HistoryIcon kind="deep"/>, <></>],
  ["transition", "draw arrow", <TrendingFlatIcon fontSize="small"/>, <kbd>T</kbd>],
  ["text", "insert text", <>&nbsp;T&nbsp;</>, <kbd>X</kbd>],
];


export type ToolSelectSetters = Setters<ToolSelectState>;

export type ToolSelectProps = {
  mouseMap: ToolSelectState,
  setMouseMap: DeepSetter<ToolSelectState>,
  showKeys: boolean,
}

export const ToolSelect = memo(function ToolSelect({mouseMap, setMouseMap, showKeys}: ToolSelectProps) {
  const {leftMouseMode, middleMouseMode, rightMouseMode} = mouseMap;
  const {setLeftMouseMode, setMiddleMouseMode, setRightMouseMode} = setMouseMap;

  useShortcuts([
    {keys: ["s"], action: () => setLeftMouseMode("select")},
    {keys: ["q"], action: () => setLeftMouseMode("pan")},
    {keys: ["a"], action: () => setLeftMouseMode("and")},
    {keys: ["r"], action: () => setLeftMouseMode("or")},
    {keys: ["c"], action: () => setLeftMouseMode("pseudo")},
    {keys: ["t"], action: () => setLeftMouseMode("transition")},
    {keys: ["x"], action: () => setLeftMouseMode("text")},
    {keys: ["h"], action: () => setLeftMouseMode(mode => mode === "shallow" ? "deep" : "shallow")},
  ]);

  const mapAnythingToAnything = (e: MouseEvent, m: ToolMode) => {
    if (e.button === 0)
      setLeftMouseMode(oldMode => oldMode === m ? "nothing" : m);
    else if (e.button === 1)
      setMiddleMouseMode(oldMode => oldMode === m ? "nothing" : m);
    else if (e.button === 2)
      setRightMouseMode(oldMode => oldMode === m ? "nothing" : m);
    e.stopPropagation();
    e.preventDefault();
  };

  // i thought a more 'fixed' mode where left mouse always selects/moves and right mouse always inserts would be preferred, but it turns out most people find it confusion. also mandatory use of right mouse is not nice for touchpad users.
  // const mapConservatively = (e: MouseEvent, m: ToolMode) => {
  //   if (e.button === 0 || e.button === 2) {
  //     if (m !== "select") {
  //       setRightMouseMode(oldMode => oldMode === m ? "nothing" : m);
  //     }
  //   }
  //   else if (e.button === 1) {
  //     if (m !== "select") {
  //       setMiddleMouseMode(oldMode => oldMode === m ? "nothing" : m);
  //     }
  //   }
  // }

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  return <>
    {insertModes.map(([m, hint, buttonTxt, keyInfo], i) => {
      const mappedTo = [] as string[];
      if (leftMouseMode === m) {
        mappedTo.push("left");
      }
      if (middleMouseMode === m) {
        mappedTo.push("middle");
      }
      if (rightMouseMode === m) {
        mappedTo.push("right");
      }
      const extraToolTip = mappedTo.length > 0 ? `\nmapped to: ${mappedTo.join('+')} mouse button` : "";
      return <KeyInfo key={m} keyInfo={keyInfo}>
        <Tooltip tooltip={hint + extraToolTip}>
          <TwoStateButton
            active={rightMouseMode===m || leftMouseMode===m || middleMouseMode === m}
            // @ts-ignore
            onMouseUp={e => mapAnythingToAnything(e, m)}
            onContextMenu={e => {e.preventDefault()}}
          >
            {buttonTxt}
            <div style={{position:'absolute', bottom: -12, right: -6, fontSize: 16, zIndex: 1}}>
              <MouseIcon
                left={leftMouseMode === m}
                middle={middleMouseMode === m}
                right={rightMouseMode === m}
              />
            </div>
          </TwoStateButton>
        </Tooltip>
      </KeyInfo>;
    })}
  </>;
})
