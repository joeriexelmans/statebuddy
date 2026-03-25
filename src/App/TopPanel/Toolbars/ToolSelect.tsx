import { ToolMode, ToolSelectState } from "@/App/migrations/v1_types";
import { useShortcuts } from "@/hooks/useShortcuts";
import HighlightAltSharpIcon from '@mui/icons-material/HighlightAltSharp';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { memo, ReactElement } from "react";
import { Tooltip } from "../../Components/Tooltip";
import { TwoStateButton } from "../../Components/TwoStateButton";
import { DeepSetter, Setters } from "../../makePartialSetter";
import { HistoryIcon, PseudoStateIcon, RountangleIcon } from "../Icons";
import { KeyInfoHidden, KeyInfoVisible } from "../KeyInfo";
import { MouseIcon } from "../MouseIcon";

const insertModes: [ToolMode, string, ReactElement, ReactElement][] = [
  ["select", "select, move, resize", <HighlightAltSharpIcon fontSize="small"/>, <></>],
  ["and", "draw AND-states", <RountangleIcon kind="and" dashed={false}/>, <kbd>A</kbd>],
  ["or", "draw OR-states", <RountangleIcon kind="or" dashed={true}/>, <kbd>O</kbd>],
  ["pseudo", "draw pseudo-states", <PseudoStateIcon/>, <kbd>P</kbd>],
  ["shallow", "draw shallow history", <HistoryIcon kind="shallow"/>, <kbd>H</kbd>],
  ["deep", "draw deep history", <HistoryIcon kind="deep"/>, <></>],
  ["transition", "draw arrows", <TrendingFlatIcon fontSize="small"/>, <kbd>T</kbd>],
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
    {keys: ["a"], action: () => setRightMouseMode("and")},
    {keys: ["o"], action: () => setRightMouseMode("or")},
    {keys: ["p"], action: () => setRightMouseMode("pseudo")},
    {keys: ["t"], action: () => setRightMouseMode("transition")},
    {keys: ["x"], action: () => setRightMouseMode("text")},
    {keys: ["h"], action: () => setRightMouseMode(mode => mode === "shallow" ? "deep" : "shallow")},
  ]);

  // for power users ... disabled!
  const mapAnythingToAnything = (e: MouseEvent, m: ToolMode) => {
    if (e.button === 0)
      setLeftMouseMode(oldMode => oldMode === m ? "nothing" : m);
    else if (e.button === 1)
      setMiddleMouseMode(oldMode => oldMode === m ? "nothing" : m);
    else if (e.button === 2)
      setRightMouseMode(oldMode => oldMode === m ? "nothing" : m);
  };

  // for normal people...
  const mapConservatively = (e: MouseEvent, m: ToolMode) => {
    if (e.button === 0 || e.button === 2) {
      if (m !== "select") {
        setRightMouseMode(oldMode => oldMode === m ? "nothing" : m);
      }
    }
    else if (e.button === 1) {
      if (m !== "select") {
        setMiddleMouseMode(oldMode => oldMode === m ? "nothing" : m);
      }
    }
  }

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
            onMouseUp={e => mapConservatively(e, m)}
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
