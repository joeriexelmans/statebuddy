import { useEffect } from "react";

export function useShortcuts(spec: {keys: string[], action: () => void}[], ignoreInputs = true) {
  // I don't know if this is efficient, but I decided to just register one event listener for every shortcut, rather than generating one big event listener for all shortcuts.
  // The benefit is that we don't have to memoize anything: useEffect will only be called if the action updated, and React allows calling useEffect for every item in a list as long as the list doesn't change.
  for (const {keys, action} of spec) {
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (ignoreInputs) {
          // @ts-ignore: don't steal keyboard events while the user is typing in a text box, etc.
          if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
        }

        if (e.ctrlKey !== keys.includes("Ctrl")) return;
        if (e.shiftKey !== keys.includes("Shift")) return;
        if (!keys.includes(e.key)) return;
        const remainingKeys = keys.filter(key => key !== "Ctrl" && key !== "Shift" && key !== e.key);
        if (remainingKeys.length !== 0) {
          console.warn("impossible shortcut sequence:", keys.join(' + '));
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        action();
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [action]);
  }
}
