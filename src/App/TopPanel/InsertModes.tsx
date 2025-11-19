import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { HistoryIcon, PseudoStateIcon, RountangleIcon } from "./Icons";

import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../Components/Tooltip";

export type InsertMode = "and" | "or" | "pseudo" | "shallow" | "deep" | "transition" | "text";

const insertModes: [InsertMode, string, ReactElement, ReactElement][] = [
  ["and", "AND-states", <RountangleIcon kind="and"/>, <kbd>A</kbd>],
  ["or", "OR-states", <RountangleIcon kind="or"/>, <kbd>O</kbd>],
  ["pseudo", "pseudo-states", <PseudoStateIcon/>, <kbd>P</kbd>],
  ["shallow", "shallow history", <HistoryIcon kind="shallow"/>, <kbd>H</kbd>],
  ["deep", "deep history", <HistoryIcon kind="deep"/>, <></>],
  ["transition", "arrows", <TrendingFlatIcon fontSize="small"/>, <kbd>T</kbd>],
  ["text", "text", <>&nbsp;T&nbsp;</>, <kbd>X</kbd>],
];

export const InsertModes = memo(function InsertModes({showKeys, insertMode, setInsertMode}: {showKeys: boolean, insertMode: InsertMode, setInsertMode: Dispatch<SetStateAction<InsertMode>>}) {

  useShortcuts([
    {keys: ["a"], action: () => setInsertMode("and")},
    {keys: ["o"], action: () => setInsertMode("or")},
    {keys: ["p"], action: () => setInsertMode("pseudo")},
    {keys: ["t"], action: () => setInsertMode("transition")},
    {keys: ["x"], action: () => setInsertMode("text")},
    {keys: ["h"], action: () => setInsertMode(mode => mode === "shallow" ? "deep" : "shallow")},
  ]);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  return <>{insertModes.map(([m, hint, buttonTxt, keyInfo]) => <KeyInfo key={m} keyInfo={keyInfo}>
    <Tooltip tooltip={"draw "+hint}>
    <button
      disabled={insertMode===m}
      className={insertMode===m ? "active":""}
      onClick={() => setInsertMode(m)}
    >{buttonTxt}</button>
    </Tooltip>
  </KeyInfo>)}</>;
})
