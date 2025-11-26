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
    // we just download the index.html file and see if it changed.
    // this works, because if any change to the code, or CSS, or any other asset was made, the hash of those objects changes, and those hashes are included in index.html.
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
      }, 60000) // <-- every minute - it's like a 500 byte request so every user generates on average 10 bytes / second
    })
    return () => clearInterval(interval);
  }, []);

  return updateAvailable;
}
