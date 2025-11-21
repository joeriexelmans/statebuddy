import { usePersistentState } from "@/hooks/usePersistentState";
import { useCallback, useMemo } from "react";

export function useTrial() {
  const [trialStarted, setTrialStarted] = usePersistentState<string|null>("stateboss-trial-started", null);

  const startTrial = useCallback(() => setTrialStarted(new Date().toISOString()), []);

  const appName = (trialStarted === null) ? "StateBuddy" : "StateBoss";

  const remainingDays = useMemo(() => {
    if (trialStarted) {
      return Math.max(30 + Math.floor((Date.now() - Date.parse(trialStarted)) / (1000 * 60 * 60 * 24)), 0);
    }
    else return 0;
  }, []);

  return {trialStarted, appName, remainingDays, startTrial};
}
