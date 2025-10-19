import { Dispatch, SetStateAction } from "react";
import { InsertMode } from "../VisualEditor/VisualEditor";

export function getKeyHandler(setMode: Dispatch<SetStateAction<InsertMode>>) {
  return function onKeyDown(e: KeyboardEvent) {
    if (!e.ctrlKey) {
      if (e.key === "a") {
        setMode("and");
      }
      if (e.key === "o") {
        setMode("or");
      }
      if (e.key === "p") {
        setMode("pseudo");
      }
      if (e.key === "t") {
        setMode("transition");
      }
      if (e.key === "x") {
        setMode("text");
      }
      if (e.key === "h") {
        setMode(oldMode => {
          if (oldMode === "shallow") return "deep";
          return "shallow";
        })
      }
    }
  }
}
