import { Tooltip } from "@/frontend/App/Components/Tooltip";
import { TwoStateButton } from "@/frontend/App/Components/TwoStateButton";
import { setPaused, setRealtime, TimeMode } from "@/frontend/App/time";

import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Dispatch, memo, SetStateAction, useCallback, useContext } from "react";
import { KeyInfoVisible, KeyInfoHidden } from "../../KeyInfo";
import { NowContext } from "@/frontend/App/NowContext";
import { useShortcuts } from "@/hooks/useShortcuts";

export type RunPauseButtonsProps = {
  showKeys: boolean;
  disabled: boolean;
  time: TimeMode;
  setTime: Dispatch<SetStateAction<TimeMode>>;
  refreshDisplayTime: () => void;
};

export const RunPauseButtons = memo(function RunPauseButtons({showKeys, time, setTime, disabled, refreshDisplayTime}: RunPauseButtonsProps) {
  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  const now = useContext(NowContext);

  const onTogglePaused = useCallback(() => {
    if (!disabled) {
      setTime(time => {
          const wallclktime = Math.round(now());
          if (time.kind === "realtime") {
            return setPaused(time, wallclktime) as TimeMode;
          }
          else {
            return setRealtime(time, wallclktime) as TimeMode;
          }
      });
    }
    refreshDisplayTime();
  }, [setTime, refreshDisplayTime, disabled, now]);

  // Spacebar pauses/resumes
  useShortcuts([
    {keys: [" "], action: onTogglePaused},
  ]);

  return <>
    <KeyInfo keyInfo={<><kbd>Space</kbd> toggles</>}>
      <Tooltip tooltip="pause simulation">
        <TwoStateButton
          active={!disabled && time.kind === "paused"}
          disabled={disabled}
          onClick={onTogglePaused}
        >
          <PauseIcon fontSize="small"/>
        </TwoStateButton>
      </Tooltip>
      <Tooltip tooltip="run simulation in real time">
        <TwoStateButton
          active={!disabled && time.kind === "realtime"}
          disabled={disabled}
          onClick={onTogglePaused}
        >
          <PlayArrowIcon fontSize="small"/>
        </TwoStateButton>
      </Tooltip>
    </KeyInfo>
  </>;
});
