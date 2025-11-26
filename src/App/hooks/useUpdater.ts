import { useEffect, useState } from "react";

export function useUpdater() {
  const [text, setText] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    setInterval(() => {
      fetch(window.location.pathname, {cache: "reload"})
      .then(res => res.text())
      .then(latestText => {
        if (text !== "" && latestText !== text) {
          setUpdateAvailable(true);
        }
        setText(latestText);
      })
      .catch(() => {});
    }, 60000) // <-- every minute - it's like a 1 KB request so every user generates on average 25 bytes / second
  }, []);

  return updateAvailable;
}
