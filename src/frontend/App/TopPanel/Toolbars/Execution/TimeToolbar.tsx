import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { Tooltip } from "@/frontend/App/Components/Tooltip";
import { formatTime } from "@/util/format_time";
import { Toolbar } from "../../Toolbar";
import { RunPauseButtons } from "./RunPauseButtons";
import { SpeedControl } from "./SpeedControl";
import { InteractiveExecutionState } from "@/frontend/App/migrations/v2_types";
import { DeepSetter } from "@/frontend/util/partial_setter";
import { Dispatch, SetStateAction, useMemo } from "react";
import { TimeMode } from "@/frontend/App/time";
import { KeyInfoVisible, KeyInfoHidden } from "../../KeyInfo";
import { SimulatorStuff, infinityIfUndefined } from '@/frontend/hooks/useInteractiveSimulator';

type ExecutionProps = {
  interactive: InteractiveExecutionState,
  setInteractive: DeepSetter<InteractiveExecutionState>,
  simulator: SimulatorStuff,
  showKeys: boolean,
  refreshDisplayTime: () => void,
  displayTime: number,
};

export function TimeToolbar({interactive, setInteractive, simulator, showKeys, displayTime, refreshDisplayTime}: ExecutionProps) {
  const nextWakeup = infinityIfUndefined(simulator.nextWakeup);
  const {currentTraceItem, simulatorCallbacks} = simulator;
  const {time} = interactive;
  const setTime = setInteractive.setTime._setShallow as Dispatch<SetStateAction<TimeMode>>;
  const lastSimTime = currentTraceItem?.simtime || 0;
  const progress = (displayTime-lastSimTime)/(nextWakeup-lastSimTime);
  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  const catchingUp = progress > 1;
  const formattedDisplayTime = useMemo(() => formatTime(displayTime), [displayTime]);
  return <>
    {/* pause / real time */}
    <Toolbar>
      <RunPauseButtons
        disabled={currentTraceItem === undefined}
        showKeys={showKeys}
        time={time}
        setTime={setTime}
        refreshDisplayTime={refreshDisplayTime}
      />
    </Toolbar>

    {/* speed */}
    <Toolbar>
      <SpeedControl time={time} setTime={setTime} showKeys={showKeys} />
    </Toolbar>

    {/* time, next */}
    <Toolbar style={{columnGap:'1em'}}>
      <Tooltip tooltip="current simulated time">
        <label>
          <AccessTimeIcon fontSize="small"/>
          <div style={{
            position: 'absolute',
            marginTop: -4,
            marginLeft: 17,
            height: 4,
            borderWidth: 0,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            backgroundColor: catchingUp
              ? 'var(--firing-transition-color)'
              : 'var(--accent-border-color)',
            width: Math.min(progress, 1)*56,
            }}
            title={catchingUp
              ? "running behind schedule! (maybe slow down a bit so i can catch up?)"
              : "are we there yet?"}
            />
          <input
            disabled={!currentTraceItem}
            value={formattedDisplayTime}
            readOnly={true}
            style={{width:56, cursor: 'not-allowed'}}
            />
        </label>
      </Tooltip>

      <Toolbar>
        <Tooltip tooltip="next timed transition at ...">
          <label>
            <AccessAlarmIcon fontSize="small"/>
            <input
              disabled={!currentTraceItem}
              value={formatTime(nextWakeup)}
              readOnly={true}
              style={{width:56, cursor: 'not-allowed'}}
            />
          </label>
        </Tooltip>
        <KeyInfo keyInfo={<kbd>Tab</kbd>}>
          <Tooltip tooltip="jump to next timed transition" align="right">
            <button
              disabled={nextWakeup === Infinity}
              onClick={simulatorCallbacks.onSkip}>
              <SkipNextIcon fontSize="small"/>
            </button>
          </Tooltip>
        </KeyInfo>
      </Toolbar>
    </Toolbar>
  </>;
}