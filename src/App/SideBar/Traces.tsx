import CachedOutlinedIcon from '@mui/icons-material/CachedOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FlareIcon from '@mui/icons-material/Flare';

import { Tooltip } from "../Components/Tooltip";
import { makeAllSetters, WithSetters } from "../makePartialSetter";
import { ExtTransitionTrace, saveExtTransitions } from '@/devs/serialize_trace';
import appStyles from "../App.module.css";
import { MoveUpDown } from '../Components/MoveUpDown';
import { DoubleClickButton } from '../Components/DoubleClickButton';
import { useCallback, useState } from 'react';
import { getSimTime, } from '@/statecharts/time';
import { SimulatorStuff, } from '../hooks/useSimulator';
import { CoupledDEVSTrace } from './CoupledDEVSTrace';
import { Statechart } from '@/statecharts/abstract_syntax';
import { PlantsState } from '../hooks/useCoupledExecution';
import { PropertyTrace } from './prepare_trace';
import { ResizeHandle } from '../Panel/ResizeHandle';
import { NicelyCentered } from '../Components/NicelyCentered';

export type SavedTraces = [string, ExtTransitionTrace][];

// Part of application state
export type TracesState = {
  showMicroSteps: boolean,
  showTransitions: boolean,
  autoScroll: boolean,
  showPlantTrace: boolean,

  savedTraces: SavedTraces,
  height: number,
}

export const defaultTracesState: TracesState = {
  autoScroll: true,
  showMicroSteps: false,
  showTransitions: false,
  showPlantTrace: false,

  savedTraces: [],
  height: 300,
}

type TracesProps = WithSetters<{
  state: TracesState,
}> & {
  simulator: SimulatorStuff,
  abstractSyntax: Statechart,
  plantsState: PlantsState,
  activePropertyTrace?: PropertyTrace,
};

export function Traces({
  state,
  setState,
  simulator,
  abstractSyntax,
  plantsState,
  activePropertyTrace,
}: TracesProps) {
  const {savedTraces, showMicroSteps, showPlantTrace, showTransitions, autoScroll, height} = state;
  const {setSavedTraces, setAutoScroll, setShowMicroSteps, setShowPlantTrace, setShowTransitions, setHeight} = makeAllSetters(setState, Object.keys(defaultTracesState) as (keyof TracesState)[]);
  const {trace, time} = simulator;

  const onSaveTrace = useCallback(() => {
    if (trace) {
      const extTrace = saveExtTransitions(trace.trace, getSimTime(time, performance.now()));
      setSavedTraces(savedTraces => [
        ...savedTraces, 
        ["", extTrace] as const,
      ])
    }
  }, [trace, setSavedTraces]);
  
  return <div style={{display: 'flex', flexGrow: 1, flexDirection: 'column'}}>
    <div>
      {savedTraces.map((savedTrace, i) =>
        <div key={i} className={appStyles.toolbar} style={{alignItems: 'center'}}>
          <Tooltip tooltip="replay trace" align="left">
            <button
              onClick={() => simulator.simulatorCallbacks.onReplayTrace(savedTrace[1])}>
              <CachedOutlinedIcon fontSize="small"/>
            </button>
          </Tooltip>
          <Tooltip tooltip='duration' align='left'>
            <div style={{display:'inline-block', width: 22, fontSize: 9, textAlign: 'center'}}>{(Math.floor(savedTrace[1].lastSimTime/1000))}s</div>
          </Tooltip>
          <Tooltip tooltip='number of input events' align='left'>
            <div style={{display:'inline-block', width: 22, fontSize: 9, textAlign: 'center'}}>({savedTrace[1].trace.length})</div>
          </Tooltip>
          <Tooltip tooltip='does not have to be unique, can be empty...' align='left' fullWidth={true} showWhen='focus'>
            <input
              placeholder="description"
              type="text"
              value={savedTrace[0]}
              style={{flexGrow: 1}}
              size={1}
              className={appStyles.description}
              onChange={e => setSavedTraces(savedTraces => savedTraces.toSpliced(i, 1, [e.target.value, savedTraces[i][1]]))}/>
          </Tooltip>
          <MoveUpDown i={i} ls={savedTraces} setter={setSavedTraces}/>
          <DoubleClickButton
            tooltip="forget this trace"
            onDoubleClick={() => setSavedTraces(savedTraces => savedTraces.toSpliced(i, 1))}
            align="right">
              <DeleteOutlineIcon fontSize="small"/>
          </DoubleClickButton>
        </div>
      )}
    </div>
    
    {/* checkboxes, buttons, ... */}
    <div className={appStyles.toolbar} style={{justifyContent: 'space-around', columnGap: '1em'}}>
      <Tooltip tooltip="plant steps are steps where only the state of a plant changed" align="left">
        <label>
          <input type="checkbox"
          checked={showPlantTrace}
          onChange={e => setShowPlantTrace(e.target.checked)}/>
          show plant steps
        </label>
      </Tooltip>
      <label>
        <input type="checkbox"
          checked={showMicroSteps}
          onChange={e => setShowMicroSteps(e.target.checked)}/>
          show microsteps
      </label>
      <label>
        <input type="checkbox"
          checked={showTransitions}
          onChange={e => setShowTransitions(e.target.checked)}/>
          show transitions
      </label>
      <Tooltip tooltip="scroll down upon new events" align="left">
        <input id="checkbox-autoscroll" type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}/>
        <label htmlFor="checkbox-autoscroll">auto-scroll</label>
      </Tooltip>
      <button
        disabled={trace === undefined}
        onClick={() => onSaveTrace()}
        style={{marginLeft: 'auto', flexGrow: 1}}
        >
        <SaveOutlinedIcon fontSize="small"/> save trace
      </button>
    </div>

    
    <div style={{
      flexGrow: 1,
      overflow:'auto',
      height,
      boxShadow: 'inset 0 10px 10px -10px rgba(0,0,0,0.4)',
      }}>
        {abstractSyntax && trace &&
          <div>
          <CoupledDEVSTrace
            ast={abstractSyntax}
            setTime={simulator.setTime}
            currentTrace={trace}
            // @ts-ignore
            setCurrentTrace={simulator.setTrace}
            traces={state}
            setTraces={setState}
            plantsState={plantsState}
            propertyTrace={activePropertyTrace}
          />
          </div>
          || <NicelyCentered style={{backgroundColor: 'var(--statusbar-bg-color)'}}>
              <div style={{display: 'flex', justifyContent: 'center', flexDirection: 'column', rowGap: 12}}>
                <div>Execution trace will appear here.</div>
                <button onClick={simulator.simulatorCallbacks.onInit}>
                  <FlareIcon fontSize='small'/>&nbsp;
                  initialize execution
                </button>
              </div>
            </NicelyCentered>
        }
    </div>
    <ResizeHandle
      getDelta={e => e.movementY}
      setSize={setHeight}
      horizontal
      minSize={30}
    />

  </div>;
}