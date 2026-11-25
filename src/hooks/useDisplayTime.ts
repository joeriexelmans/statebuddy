import { NowContext } from "@/App/NowContext";
import { getSimTime, TimeMode } from "@/App/time";
import { useCallback, useContext, useEffect, useState } from "react";

export function useDisplayTime(time: TimeMode) {
  const [displayTime, setDisplayTime] = useState(0);

  const getNow = useContext(NowContext);

  const refreshDisplayTime = useCallback(() => {
    const now = Math.round(getNow());
    const timeMs = getSimTime(time, now);
    setDisplayTime((timeMs));
  }, [time, setDisplayTime, getNow]);

  useEffect(() => {
    // This has no effect on statechart execution. In between events, the statechart is doing nothing. However, by updating the displayed time, we give the illusion of continuous progress.
    refreshDisplayTime();

    const renderFrame = () => {
      refreshDisplayTime();
      req = requestAnimationFrame(renderFrame);
    }
    let req = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(req);
  }, [time, refreshDisplayTime]);

  return {displayTime, refreshDisplayTime};
}