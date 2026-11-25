import { useLocalStorage } from "@/hooks/usePersistentState";
import { useCallback, useContext, useMemo } from "react";
import { NowContext } from "../NowContext";

export type Trial = {
  trialStarted: boolean,
  appName: string,
  remainingDays: number,
  startTrial: () => void,
}

export function useTrial() {
  const now = useContext(NowContext);
  const [whenStarted, setWhenStarted] = useLocalStorage<string|null>("stateboss-trial-started", null);

  const startTrial = useCallback(() => {
    const now = new Date().toISOString();
    setWhenStarted(now);
  }, [setWhenStarted]);

  const appName = (whenStarted === null) ? "StateBuddy" : "StateBoss";

  const remainingDays = useMemo(() => {
    if (whenStarted) {
      return Math.max(
        30 + Math.floor(
          (Date.parse(whenStarted) - now()) /
            (1000 * 60 * 60 * 24)),
        0);
    }
    else return 0;
  }, [whenStarted, now]);

  const trialStarted = Boolean(whenStarted);

  return useMemo(() =>
    ({trialStarted, appName, remainingDays, startTrial}),
    [trialStarted, appName, remainingDays, startTrial]
  ) as Trial;
}
