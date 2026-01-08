import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { HistoryIcon, PseudoStateIcon, RountangleIcon } from "./Icons";

import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../Components/Tooltip";
import { TwoStateButton } from "../Components/TwoStateButton";
import HighlightAltSharpIcon from '@mui/icons-material/HighlightAltSharp';
import { Setters } from "../makePartialSetter";
import { MouseIcon } from "./MouseIcon";

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
  insertMode: ToolMode,      // <-- the tool that is activated by right mouse button (should be renamed to 'rightMouseMode' but that would break compatibility with existing StateBuddy models)
};

export type ToolSelectSetters = Setters<ToolSelectState>;

export const defaultToolSelectState: ToolSelectState = {
  leftMouseMode: 'select',
  middleMouseMode: 'nothing',
  insertMode: 'and',
};

export const ToolSelect = memo(function InsertModes({showKeys, insertMode, setInsertMode, leftMouseMode, setLeftMouseMode, middleMouseMode, setMiddleMouseMode}: {showKeys: boolean} & ToolSelectState & ToolSelectSetters) {
  useShortcuts([
    {keys: ["a"], action: () => setInsertMode("and")},
    {keys: ["o"], action: () => setInsertMode("or")},
    {keys: ["p"], action: () => setInsertMode("pseudo")},
    {keys: ["t"], action: () => setInsertMode("transition")},
    {keys: ["x"], action: () => setInsertMode("text")},
    {keys: ["h"], action: () => setInsertMode(mode => mode === "shallow" ? "deep" : "shallow")},
  ]);

  console.log({leftMouseMode, insertMode});

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  return <>
    {insertModes.map(([m, hint, buttonTxt, keyInfo], i) =>
      <KeyInfo key={m} keyInfo={keyInfo}>
        <Tooltip tooltip={hint }>
          <TwoStateButton
            active={insertMode===m || leftMouseMode===m || middleMouseMode === m}
            onMouseUp={e => {
              if (e.button === 0)
                setLeftMouseMode(oldMode => oldMode === m ? "nothing" : m);
              else if (e.button === 1)
                setMiddleMouseMode(oldMode => oldMode === m ? "nothing" : m);
              else if (e.button === 2)
                setInsertMode(oldMode => oldMode === m ? "nothing" : m);
            }}
            onContextMenu={e => {e.preventDefault()}}
          >
            {buttonTxt}
            <div style={{position:'absolute', bottom: -12, right: -6, fontSize: 16, zIndex: 1}}>
              <MouseIcon left={leftMouseMode === m}  right={insertMode === m} middle={middleMouseMode === m}/>
            </div>
          </TwoStateButton>
        </Tooltip>
      </KeyInfo>)}
  </>;
})
