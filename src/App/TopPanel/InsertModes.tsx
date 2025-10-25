import { Dispatch, memo, ReactElement, SetStateAction } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { InsertMode } from "@/App/VisualEditor/VisualEditor";
import { HistoryIcon, PseudoStateIcon, RountangleIcon } from "./Icons";

import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

const insertModes: [InsertMode, string, ReactElement, ReactElement][] = [
  ["and", "AND-states", <RountangleIcon kind="and"/>, <kbd>A</kbd>],
  ["or", "OR-states", <RountangleIcon kind="or"/>, <kbd>O</kbd>],
  ["pseudo", "pseudo-states", <PseudoStateIcon/>, <kbd>P</kbd>],
  ["shallow", "shallow history", <HistoryIcon kind="shallow"/>, <kbd>H</kbd>],
  ["deep", "deep history", <HistoryIcon kind="deep"/>, <></>],
  ["transition", "transitions", <TrendingFlatIcon fontSize="small"/>, <kbd>T</kbd>],
  ["text", "text", <>&nbsp;T&nbsp;</>, <kbd>X</kbd>],
];

export const InsertModes = memo(function InsertModes({showKeys, insertMode, setInsertMode}: {showKeys: boolean, insertMode: InsertMode, setInsertMode: Dispatch<SetStateAction<InsertMode>>}) {
  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  return <>{insertModes.map(([m, hint, buttonTxt, keyInfo]) => <KeyInfo key={m} keyInfo={keyInfo}>
    <button
      title={"insert "+hint}
      disabled={insertMode===m}
      className={insertMode===m ? "active":""}
      onClick={() => setInsertMode(m)}
    >{buttonTxt}</button>
  </KeyInfo>)}</>;
})