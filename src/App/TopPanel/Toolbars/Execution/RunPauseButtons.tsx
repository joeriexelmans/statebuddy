import { Tooltip } from "@/App/Components/Tooltip";
import { TwoStateButton } from "@/App/Components/TwoStateButton";
import { TimeMode } from "@/statecharts/time";

import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { DEVSTraceItem } from "@/devs/trace";
import { CoupledState } from "@/App/hooks/useSimulator";
import { objectsEqual } from "@/util/util";
import { memo } from "react";
import { KeyInfoVisible, KeyInfoHidden } from "../../KeyInfo";

export type RunPauseButtonsProps = {
  showKeys: boolean;
  time: TimeMode;
  disabled: boolean;
  currentTraceItem?: DEVSTraceItem<CoupledState>;
  onTogglePaused: () => void;
};

export const RunPauseButtons = memo(function RunPauseButtons({showKeys, time, disabled, onTogglePaused: togglePaused}: RunPauseButtonsProps) {
  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  return <>
    <KeyInfo keyInfo={<><kbd>Space</kbd> toggles</>}>
      <Tooltip tooltip="pause simulation">
        <TwoStateButton
          active={!disabled && time.kind === "paused"}
          disabled={disabled}
          onClick={togglePaused}
        >
          <PauseIcon fontSize="small"/>
        </TwoStateButton>
      </Tooltip>
      <Tooltip tooltip="run simulation in real time">
        <TwoStateButton
          active={!disabled && time.kind === "realtime"}
          disabled={disabled}
          onClick={togglePaused}
        >
          <PlayArrowIcon fontSize="small"/>
        </TwoStateButton>
      </Tooltip>
    </KeyInfo>
  </>;
});
