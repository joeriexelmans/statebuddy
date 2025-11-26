import { useCallback, useEffect, useState } from "react";
 
export function useUpdater() {
  const [[_, updateAvailable], set] = useState<[string, boolean]>(["", false]);

  const init = useCallback(() => {
    return fetch(window.location.pathname)
    .then(res => res.text())
    .then(text => set([text, false]))
    .catch(() => {});
  }, []);

  const checkForUpdates = useCallback(() => {
    fetch(window.location.pathname, {cache: "reload"})
    .then(res => res.text())
    .then(latestText => {
      set(([text, upd]) => {
        if (latestText !== text) {
          return [latestText, true]
        }
        return [latestText, upd];
      })
    })
    .catch(() => {});
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    init().then(() => {
      interval = setInterval(() => {
        checkForUpdates();
      }, 1000) // <-- every minute - it's like a 1 KB request so every user generates on average 25 bytes / second
    })
    return () => clearInterval(interval);
  }, []);

  return updateAvailable;
}
