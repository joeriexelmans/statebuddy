import { Dispatch, memo, SetStateAction, useCallback, useContext, useMemo } from 'react';

import { Tooltip } from '@/App/Components/Tooltip';
import { infinityIfUndefined, SimulatorStuff } from '@/App/hooks/useInteractiveSimulator';

// icons
import FlareIcon from '@mui/icons-material/Flare';
import ClearIcon from '@mui/icons-material/Clear';

import { TimeMode } from '@/App/time';
import { KeyInfoVisible, KeyInfoHidden } from '../../KeyInfo';
import { Toolbar } from '../../Toolbar';
import { InteractiveExecutionState } from '@/App/migrations/v2_types';
import { DeepSetter } from '@/util/partial_setter';
import { TimeToolbar } from './TimeToolbar';

type ExecutionProps = {
  interactive: InteractiveExecutionState,
  setInteractive: DeepSetter<InteractiveExecutionState>,
  simulator: SimulatorStuff,
  showKeys: boolean,
  refreshDisplayTime: () => void,
  displayTime: number,
};

const toolbarStyle = {columnGap: '1em'};

export const ExecutionToolbar = memo(function ExecutionToolbar({interactive, setInteractive, simulator, showKeys, displayTime, refreshDisplayTime}: ExecutionProps) {
  const nextWakeup = infinityIfUndefined(simulator.nextWakeup);
  const {currentTraceItem, simulatorCallbacks} = simulator;
  const lastSimTime = currentTraceItem?.simtime || 0;
  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  // User clicked play / pause:

  return <Toolbar style={toolbarStyle}>
    {/* init / clear */}
    <Toolbar>
      <InitClear
        KeyInfo={KeyInfo}
        onInit={simulatorCallbacks.onInit}
        onClear={simulatorCallbacks.onClear}
        disabled={!simulator.trace}
      />
    </Toolbar>
    <TimeToolbar
      displayTime={displayTime}
      interactive={interactive}
      refreshDisplayTime={refreshDisplayTime}
      setInteractive={setInteractive}
      showKeys={showKeys}
      simulator={simulator}
    />
  </Toolbar>;
});


export const InitClear = memo(function InitClear({KeyInfo, onInit, onClear, disabled}: {
  KeyInfo: any,
  onInit: () => void,
  onClear: () => void,
  disabled: boolean,
}) {
  return <>
    <KeyInfo keyInfo={<kbd>I</kbd>}>
      <Tooltip tooltip="(re)initialize simulation" align='left'>
        <button onClick={onInit} >
          <FlareIcon fontSize="small"/>
        </button>
      </Tooltip>
    </KeyInfo>
    <KeyInfo keyInfo={<><kbd>Shift</kbd>+<kbd>C</kbd></>}>
      <Tooltip tooltip="clear the simulation" align='left'>
        <button onClick={onClear} disabled={disabled}>
          <ClearIcon fontSize="small"/>
        </button>
      </Tooltip>
    </KeyInfo>
  </>
})