import { useCallback, useMemo } from 'react';

import { Toolbar } from '../Toolbar';
import { Tooltip } from '@/App/Components/Tooltip';
import { KeyInfoHidden, KeyInfoVisible } from '../KeyInfo';
import { infinityIfUndefined, SimulatorStuff } from '@/App/hooks/useSimulator';
import { RunPauseButtons } from './RunPauseButtons';
import { SpeedControl } from './SpeedControl';

// icons
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FlareIcon from '@mui/icons-material/Flare';
import ClearIcon from '@mui/icons-material/Clear';

import { formatTime } from '@/util/util';
import { usePersistentState } from '@/hooks/usePersistentState';
import { setPaused, setRealtime } from '@/statecharts/time';
import { useShortcuts } from '@/hooks/useShortcuts';

type ExecutionProps = {
  simulator: SimulatorStuff,
  showKeys: boolean,
  refreshDisplayTime: () => void,
  displayTime: number,
};

export function Execution({simulator, showKeys, refreshDisplayTime, displayTime}: ExecutionProps) {
  const [timescale, setTimescale] = usePersistentState("timescale", 1);

  const nextWakeup = infinityIfUndefined(simulator.nextWakeup);
  const {currentTraceItem, simulatorCallbacks, time, setTime} = simulator;
  const lastSimTime = currentTraceItem?.simtime || 0;
  const progress = (displayTime-lastSimTime)/(nextWakeup-lastSimTime);
  const catchingUp = progress > 1;
  const formattedDisplayTime = useMemo(() => formatTime(displayTime), [displayTime]);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  // User clicked play / pause:
  const onTogglePaused = useCallback(() => {
    if (currentTraceItem) {
      setTime(time => {
        const wallclktime = Math.round(performance.now());
        if (time.kind === "realtime") {
          return setPaused(time, wallclktime);
        }
        else {
          return setRealtime(time, timescale, wallclktime);
        }
      });
      refreshDisplayTime();
    }
  }, [setTime, timescale, refreshDisplayTime, currentTraceItem]);

  // Spacebar pauses/resumes
  useShortcuts([
    {keys: [" "], action: onTogglePaused},
  ]);

  return <Toolbar style={{columnGap: '1em'}}>
    {/* init / clear */}
    <Toolbar>
      <KeyInfo keyInfo={<kbd>I</kbd>}>
        <Tooltip tooltip="(re)initialize simulation" align='left'>
          <button onClick={simulatorCallbacks.onInit} >
            <FlareIcon fontSize="small"/>
          </button>
        </Tooltip>
      </KeyInfo>
      <KeyInfo keyInfo={<kbd>C</kbd>}>
        <Tooltip tooltip="clear the simulation" align='left'>
          <button onClick={simulatorCallbacks.onClear} disabled={!currentTraceItem}>
            <ClearIcon fontSize="small"/>
          </button>
        </Tooltip>
      </KeyInfo>
    </Toolbar>
      
    {/* pause / real time */}
    <Toolbar>
      <RunPauseButtons
        disabled={currentTraceItem === undefined}
        showKeys={showKeys}
        time={time}
        onTogglePaused={onTogglePaused}
      />
    </Toolbar>

    {/* speed */}
    <Toolbar>
      <SpeedControl setTime={setTime} timescale={timescale} setTimescale={setTimescale} showKeys={showKeys} />
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
  </Toolbar>;
}
