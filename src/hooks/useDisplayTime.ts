import { getSimTime, TimeMode } from "@/statecharts/time";
import { useCallback, useEffect, useState } from "react";

export function useDisplayTime(time: TimeMode) {
  const [displayTime, setDisplayTime] = useState(0);

  const refreshDisplayTime = useCallback(() => {
    const now = Math.round(performance.now());
    const timeMs = getSimTime(time, now);
    setDisplayTime((timeMs));
  }, [time, setDisplayTime]);

  useEffect(() => {
    // This has no effect on statechart execution. In between events, the statechart is doing nothing. However, by updating the displayed time, we give the illusion of continuous progress.
    const interval = setInterval(() => {
      refreshDisplayTime();
    }, 43); // every X ms -> we want a value that makes the numbers 'dance' while not using too much CPU
    return () => {
      clearInterval(interval);
    }
  }, [time, refreshDisplayTime]);

  return {displayTime, refreshDisplayTime};
}