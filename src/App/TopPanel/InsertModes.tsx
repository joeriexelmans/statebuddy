import { Dispatch, memo, ReactElement, SetStateAction, useCallback, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { HistoryIcon, PseudoStateIcon, RountangleIcon } from "./Icons";

import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

export type InsertMode = "and" | "or" | "pseudo" | "shallow" | "deep" | "transition" | "text";

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

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    // @ts-ignore
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;

    if (!e.ctrlKey) {
      if (e.key === "a") {
        e.preventDefault();
        setInsertMode("and");
      }
      if (e.key === "o") {
        e.preventDefault();
        setInsertMode("or");
      }
      if (e.key === "p") {
        e.preventDefault();
        setInsertMode("pseudo");
      }
      if (e.key === "t") {
        e.preventDefault();
        setInsertMode("transition");
      }
      if (e.key === "x") {
        e.preventDefault();
        setInsertMode("text");
      }
      if (e.key === "h") {
        e.preventDefault();
        setInsertMode(oldMode => {
          if (oldMode === "shallow") return "deep";
          return "shallow";
        })
      }
    }
  }, [setInsertMode]);

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

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
