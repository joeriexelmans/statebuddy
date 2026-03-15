import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "../KeyInfo";
import { HistoryIcon, PseudoStateIcon, RountangleIcon } from "../Icons";

import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../../Components/Tooltip";
import { TwoStateButton } from "../../Components/TwoStateButton";
import HighlightAltSharpIcon from '@mui/icons-material/HighlightAltSharp';
import { makeAllSetters, makePartialSetter, Setters, WithSetters } from "../../makePartialSetter";
import { MouseIcon } from "../MouseIcon";

export type ToolMode = "select" | "and" | "or" | "pseudo" | "shallow" | "deep" | "transition" | "text" | "nothing";

const insertModes: [ToolMode, string, ReactElement, ReactElement][] = [
  ["select", "select, move, resize", <HighlightAltSharpIcon fontSize="small"/>, <></>],
  ["and", "draw AND-states", <RountangleIcon kind="and"/>, <kbd>A</kbd>],
  ["or", "draw OR-states", <RountangleIcon kind="or"/>, <kbd>O</kbd>],
  ["pseudo", "draw pseudo-states", <PseudoStateIcon/>, <kbd>P</kbd>],
  ["shallow", "draw shallow history", <HistoryIcon kind="shallow"/>, <kbd>H</kbd>],
  ["deep", "draw deep history", <HistoryIcon kind="deep"/>, <></>],
  ["transition", "draw arrows", <TrendingFlatIcon fontSize="small"/>, <kbd>T</kbd>],
  ["text", "insert text", <>&nbsp;T&nbsp;</>, <kbd>X</kbd>],
];

export type ToolSelectState = {
  leftMouseMode: ToolMode,   // <-- the tool that is activated by left mouse button
  middleMouseMode: ToolMode, // <-- the tool that is activated by middle mouse button
  rightMouseMode: ToolMode,      // <-- the tool that is activated by right mouse button
};

export type ToolSelectSetters = Setters<ToolSelectState>;

export const defaultToolSelectState: ToolSelectState = {
  leftMouseMode: 'select',
  middleMouseMode: 'nothing',
  rightMouseMode: 'and',
};

export type ToolSelectProps = WithSetters<{
  mouseMap: ToolSelectState,
}> & {
  showKeys: boolean,
}

export const ToolSelect = memo(function ToolSelect({mouseMap, setMouseMap, showKeys}: ToolSelectProps) {
  const {leftMouseMode, middleMouseMode, rightMouseMode} = mouseMap;
  const {setLeftMouseMode, setMiddleMouseMode, setRightMouseMode} = makeAllSetters(setMouseMap, Object.keys(mouseMap) as (keyof ToolSelectState)[]);

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
