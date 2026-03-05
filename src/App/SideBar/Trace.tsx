import styles from "./Trace.module.css";

import { whoMadeTransition } from "@/devs/coupled_trace";
import { Statechart2DEVSState } from "@/devs/sc2devs";
import { DEVSTrace, DEVSTraceItem, DEVSTraceItemExtTransition, DEVSTraceItemInit, DEVSTraceItemIntTransition } from "@/devs/trace";
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import FlareIcon from '@mui/icons-material/Flare';
import { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { Statechart, stateDescription, Transition } from "../../statecharts/abstract_syntax";
import { TimeMode } from "../../statecharts/time";
import { formatTime, jsonDeepEqual, memoizeOne } from "../../util/util";
import { Tooltip } from "../Components/Tooltip";
import { CoupledState, PlantsState, StateBuddyTraceState } from "../hooks/useSimulator";
import { WithSetters } from "../makePartialSetter";
import { ShowOutputEvents } from "./ShowAST";
import { Status } from "./Status";

type PropertyTrace = [number, boolean][];
type PropertyStatus = "pending" | "satisfied" | "violated";

function lookupPropertyStatus(simtime: number, propertyTrace: PropertyTrace, startAt=0): [number, boolean | undefined] {
  let i = startAt;
  while (i >= 0 && i < propertyTrace.length) {
    const [timestamp] = propertyTrace[i];
    if (timestamp === simtime) {
      // exact match
      break;
    }
    else if (timestamp > simtime) {
      i--;
      // too far
      break;
    }
    // continue...
    i++;
  }
  i = Math.min(i, propertyTrace.length-1);
  return [i, propertyTrace[i] && propertyTrace[i][1]];
}


type TraceProps = WithSetters<{
  trace: StateBuddyTraceState,
  showMicroSteps: boolean,
}> & {
  // clicking on an item in the trace will jump to it so we need to set the time to that point.
  setTime: Dispatch<SetStateAction<TimeMode>>,

  ast: Statechart,

  // // just some switches
  showTransitions: boolean,
  showPlantTrace: boolean,

  // result of checking a property is a trace of booleans which we display in the trace
  propertyTrace: PropertyTrace | null,
  plantsState: PlantsState,
}

// An 'output step' is when a Statechart performs an intTransition immediately after handling an input event (extTransition), with the purpose of only outputting some events.
// If a Statechart makes an output step, we render that step slightly differently (we hide the timer icon), so it becomes a bit clearer that in the world of Statecharts, the output step was caused by (or even stronger: is part of) the previous step.
// This heuristic (hopefully) works for our Statechart and also for plants that are implemented as a Statechart.
function isOutputStepHeuristic(trace: DEVSTrace<Statechart2DEVSState>) {
  const itemState = trace.at(-1)!;
  const prevItemState = trace.at(-2);
  const prevScheduledOutputs = prevItemState?.newState.outputQueue; // <-- could also be undefined if newState does not have property 'outputQueue'...
  const curOutputs = itemState.kind === "intTransition" && itemState.outputEvents;
  const isOutputStep = jsonDeepEqual(prevScheduledOutputs, curOutputs) // the scheduled outputs of previous SC step are equal to the current outputs
    && prevItemState?.simtime === itemState.simtime // <-- time didn't change
    && itemState.newState.outputQueue?.length === 0; // <-- our current output queue is empty (because we outputted all of our outputs)
  return isOutputStep;
}

// Things are a bit funny here. We want to render the execution history of our Statechart, but we have a Coupled DEVS trace containing all the steps made by both the Statechart and the plant(s). We offer the user to hide steps made by the plant(s).
export function Trace({trace, setTrace, setTime, ast, showMicroSteps, setShowMicroSteps, showTransitions, showPlantTrace, propertyTrace, plantsState}: TraceProps) {
  let j=0;
  return <div>
    {trace.trace.map((item, i) => {
      const prevItem = trace.trace[i-1];

      // in every step of the Coupled DEVS, each component can step at most once
      const whichPlantsStepped = Object.entries(item.newState).flatMap(([plantId, s]) => (s !== prevItem?.newState[plantId]) ? [plantId] : []);

      const isPlantStep = !whichPlantsStepped.includes("sc");

      let satisfied;
      [j, satisfied] = lookupPropertyStatus(item.simtime, propertyTrace || [], j);
      let propertyStatus: PropertyStatus = "pending";
      if (satisfied !== null && satisfied !== undefined) {
        propertyStatus = (satisfied ? "satisfied" : "violated");
      }

      if (isPlantStep && !showPlantTrace) {
        return <></>;
      }
      return <div
          className={styles.traceItem
                    + ' ' + ((trace.idx === i) ? styles.active : "")
                    + ' ' + (isPlantStep ? styles.plantStep : "")}
          onDoubleClick={e => {
            setShowMicroSteps(x => !x);
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={e => {
            if (e.button === 0) {
              setTrace(trace => ({trace: trace.trace, idx: i}));
              setTime(_ => ({kind: "paused", simtime: item.simtime}));
            }
          }}
        >
        <div style={{display: 'flex', gap: '1em'}}>
          {/* #{i} */}
          <CoupledDEVSTraceItem
            item={item}
            prevItem={prevItem}
            status={propertyStatus}
            plantsState={plantsState}
            // only show micro-steps of currently selected item:
            showMicroSteps={showMicroSteps && i === trace.idx}
            showTransitions={showTransitions}
            ast={ast}
          />
        </div>
      </div>;
    })}
  </div>;
}

function TraceItemHeader({status, simtime, hide}: {status: PropertyStatus, simtime: number, hide: boolean}) {
  return <>
    {/* property check result */}
    <div style={{visibility: hide ? "hidden" : undefined}}>
      <Status status={status}/>
    </div>

    {/* timestamp */}
    <div style={{visibility: hide ? "hidden" : undefined}}>
      <Tooltip tooltip="timestamp">
        <div style={{textAlign: 'right'}}>
          {formatTime(simtime)}
        </div>
      </Tooltip>
    </div>
  </>;
}

function lookupName(plantsState: PlantsState, plantId: string) {
  return plantsState.plants.find(({id}) => id === plantId)?.name || plantId;
}

type ThingsToPassOn = {
  status: PropertyStatus,
  showMicroSteps: boolean,
  showTransitions: boolean,
  plantsState: PlantsState,
  ast: Statechart,
}

function CoupledDEVSTraceItem({item, prevItem, status, ...thingsToPassOn}: {
  item: DEVSTraceItem<CoupledState>,
  prevItem: DEVSTraceItem<CoupledState>,
} & ThingsToPassOn) {
  const commonArgs = {status, ...thingsToPassOn};
  if (item.kind === "init") {
    return <CoupledDEVSInitialization item={item} {...commonArgs} />;
  }
  else if (item.kind === "intTransition") {
    return <CoupledDEVSInternalTransition item={item} prevItem={prevItem} {...commonArgs} />;
  }
  else if (item.kind === "extTransition") {
    return <CoupledDEVSExternalTransition item={item} prevItem={prevItem} {...commonArgs} />;
  }
}

const allTransitions = memoizeOne(function allTransitions(ast: Statechart) {
  const alreadyHave = new Set<string>();
  return [...ast.transitions.values().flatMap(ts => {
    return ts.filter(t => !alreadyHave.has(t.uid) && alreadyHave.add(t.uid));
  })];
}, (a,b) => a === b);

function getFiredTransitions(ast: Statechart, item: DEVSTraceItem<Statechart2DEVSState>) {
  const all = allTransitions(ast);
  const result = all.filter(t => item.newState.bigstep.firedTransitions.includes(t.uid));
  console.log({ast, all, fired: item.newState.bigstep.firedTransitions, result});
  return result;
}

function CoupledDEVSInitialization({item, status, plantsState, showMicroSteps, showTransitions, ast}: {
  item: DEVSTraceItemInit<CoupledState>,
} & ThingsToPassOn) {
  // just show the initialization of every component:
  return <>
    <TraceItemHeader hide={false} simtime={0} status={status} />
    {Object.entries(item.newState).map(([componentId, componentTrace]) => {
      const componentTraceItem = componentTrace.at(-1)!;
      const componentName = plantsState.plants.find(({id}) => id === componentId)?.name || componentId;
      return <StepColumn key={componentId}>
        <div>{componentName}</div>
        <DEVSStepCause item={componentTraceItem} />
        {componentId === "sc" && <>
          {showMicroSteps && <MicroSteps item={componentTraceItem}/>}
          {showTransitions && <ShowFiredTransitions
            firedTransitions={getFiredTransitions(ast, componentTraceItem)} />}
        </>}
      </StepColumn>;
    })}
  </>;
}

// An internal transition step made by Coupled DEVS
function CoupledDEVSInternalTransition({item, prevItem, status, showMicroSteps, showTransitions, plantsState, ast}: {
  item: DEVSTraceItemIntTransition<CoupledState>,
  prevItem: DEVSTraceItem<CoupledState>,
} & ThingsToPassOn) {
  // one component will have made 1 intTransition, and some other components may have made 1 extTransition.
  const componentMadeIntTransition = whoMadeTransition([prevItem, item], "intTransition");
  const blessedTrace = item.newState[componentMadeIntTransition];
  const blessedItem = blessedTrace.at(-1)! as DEVSTraceItemIntTransition<any>;

  const isOutputStep = isOutputStepHeuristic(blessedTrace);

  return <>
    {/* header */}
    <TraceItemHeader hide={isOutputStep} simtime={item.simtime} status={status}/>

    {/* first we show the component that made the intTransition */}
    <StepColumn>
      <div>{lookupName(plantsState, componentMadeIntTransition)}</div>
      {!isOutputStep && <DEVSStepCause item={blessedItem} />}
      <ShowOutputEvents outputEvents={blessedItem.outputEvents} />
      {showMicroSteps && componentMadeIntTransition === "sc" && <MicroSteps item={blessedItem}/>}
      {showTransitions && componentMadeIntTransition === "sc" && <ShowFiredTransitions firedTransitions={getFiredTransitions(ast, blessedItem)}/>}
    </StepColumn>

    {/* then we show the components that made an extTransition */}
    {Object.entries(item.newState).map(([componentId, componentTrace]) => {
      if (componentId === componentMadeIntTransition) {
        // we've already rendered this one
        return <></>;
      }
      if (prevItem.newState[componentId] === componentTrace) {
        // component did not step
        return <></>;
      }
      return <StepColumn>
        <div>{lookupName(plantsState, componentId)}</div>
        <DEVSExternalTransition
          item={componentTrace.at(-1)!}
          showMicroSteps={showMicroSteps && componentId === "sc"}
          showTransitions={showTransitions && componentId === "sc"}
          ast={ast}
        />
      </StepColumn>;
    })}
  </>;
}

function StepColumn({children}: PropsWithChildren<{}>) {
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'start'}}>
    {children}
  </div>;
}

function DEVSExternalTransition({item, showMicroSteps, showTransitions, ast}: {
  item: DEVSTraceItem<any>,
  showMicroSteps: boolean,
  showTransitions: boolean,
  ast: Statechart,
}) {
  return <StepColumn>
    <DEVSStepCause item={item}/>
    {showMicroSteps && <MicroSteps item={item}/>}
    {showTransitions && <StepColumn>
      <ShowFiredTransitions firedTransitions={getFiredTransitions(ast, item)} />
    </StepColumn>}
  </StepColumn>;
}

// An internal transition step made by Coupled DEVS
function CoupledDEVSExternalTransition({item, prevItem, status, showMicroSteps, showTransitions, plantsState, ast}: {
  item: DEVSTraceItemExtTransition<CoupledState>,
  prevItem: DEVSTraceItem<CoupledState>,
} & ThingsToPassOn) {
  const componentMadeExtTransition = whoMadeTransition([prevItem, item], "extTransition");
  const componentStep = item.newState.sc.at(-1)!;
  return <>
    <TraceItemHeader hide={false} simtime={item.simtime} status={status} />
    <StepColumn>
      <div>{lookupName(plantsState, componentMadeExtTransition)}</div>
      <DEVSExternalTransition
        item={componentStep}
        showMicroSteps={showMicroSteps && componentMadeExtTransition === "sc"}
        showTransitions={showTransitions && componentMadeExtTransition === "sc"}
        ast={ast}
      />
    </StepColumn>
  </>;
}


function DEVSStepCause({item}: {item: DEVSTraceItem<any>}) {
  if (item.kind === "init") {
    return <div className={styles.inputEvent}>
      <Tooltip tooltip="initialization" align="left">
        <FlareIcon fontSize="small"/>
      </Tooltip>
    </div>;
  }
  else if (item.kind === "intTransition") {
    return <div className={styles.inputEvent}>
      <Tooltip tooltip="timer elapse" align="left">
        <AccessAlarmIcon fontSize="small"/>
      </Tooltip>
    </div>
  }
  else if (item.kind === "extTransition") {
    return item.bagOfInputs.map((e, i) =>
      <div key={i} className={styles.inputEvent}>
        <Tooltip tooltip="input event" align="left">
        &#8600;
        {e.name}
        <EventParam param={e.param}/>
      </Tooltip>
      </div>);
  }
}


// function Step({item, isOutputStep}: {item: DEVSTraceItem<any>, isOutputStep: boolean}) {
//   const scState = item;
//   if (scState.kind === "init") {
//     return <div className={styles.inputEvent}>
//       <Tooltip tooltip="execution initialized" align="left">
//         <FlareIcon fontSize="small"/>
//       </Tooltip>
//     </div>;
//   }
//   else if (scState.kind === "intTransition") {
//     return <>
//       <div style={{width: 24}}>
//         {!isOutputStep && <div className={styles.inputEvent}>
//           <Tooltip tooltip="timer elapse" align="left">
//             <AccessAlarmIcon fontSize="small"/>
//           </Tooltip>
//           {/* todo: show which timer elapsed? */}
//         </div>}
//       </div>
//       <ShowOutputEvents outputEvents={scState.outputEvents}/>
//     </>;
//   }
//   else if (scState.kind === "extTransition") {
//     return <div className={styles.inputEvent}>
//       <Tooltip tooltip="input event" align="left">
//         {/* <BoltIcon fontSize="small"/> */}
//         &#8600;
//         {scState.eventName}
//         <EventParam param={scState.param}/>
//       </Tooltip>
//     </div>;
//   }
// }



// function TraceItem({item, isOutputStep, isPlantStep, whichPlantsStepped}: {item: DEVSTraceItem<CoupledState>, isOutputStep: boolean, isPlantStep: boolean, whichPlantsStepped: string[]}) {
//   if (isPlantStep) {
//     return <></>;
//   }
//   else {
//     const scState = item.newState.sc.at(-1)!;
//     if (scState.kind === "init") {
//       return <div className={styles.inputEvent}>
//         <Tooltip tooltip="execution initialized" align="left">
//           <FlareIcon fontSize="small"/>
//         </Tooltip>
//       </div>;
//     }
//     else if (scState.kind === "intTransition") {
//       return <>
//         <div style={{width: 24}}>
//           {!isOutputStep && <div className={styles.inputEvent}>
//             <Tooltip tooltip="timer elapse" align="left">
//               <AccessAlarmIcon fontSize="small"/>
//             </Tooltip>
//             {/* todo: show which timer elapsed? */}
//           </div>}
//         </div>
//         <ShowOutputEvents outputEvents={scState.outputEvents}/>
//       </>;
//     }
//     else if (scState.kind === "extTransition") {
//       return <div className={styles.inputEvent}>
//         <Tooltip tooltip="input event" align="left">
//           {/* <BoltIcon fontSize="small"/> */}
//           &#8600;
//           {scState.eventName}
//           <EventParam param={scState.param}/>
//         </Tooltip>
//       </div>;
//     }
//   }
// }

// export function Trace({trace, setTrace, ast, setTime, showPlantTrace, propertyTrace, showMicroSteps}: TraceProps) {
//   const onMouseDown = useCallback((idx: number, timestamp: number) => {
//     setTrace(trace => trace && {
//       ...trace,
//       idx,
//     });
//     setTime(time => timeTravel(time, timestamp, performance.now()));
//   }, [setTrace, setTime]);

//   if (trace === null) {
//     return <></>;
//   }
//   let j = 0;
//   return trace.trace.map((item, i) => {
//     const prevItem = trace.trace[i-1];
//     // @ts-ignore
//     const isPlantStep = item.state?.sc === prevItem?.state?.sc;
//     if (!showPlantTrace && isPlantStep) {
//       return <></>
//     }
//     let propertyStatus: PropertyStatus = "pending";
//     if (propertyTrace !== null) {
//       let satisfied;
//       [j, satisfied] = lookupPropertyStatus(item.simtime, propertyTrace, j);
//       // console.log(item.simtime, j, propertyTrace[j]);
//       if (satisfied !== null && satisfied !== undefined) {
//         propertyStatus = (satisfied ? "satisfied" : "violated");
//       }
//     }
//     return <RTHistoryItem
//       ast={ast}
//       idx={i}
//       item={item}
//       prevItem={prevItem}
//       isPlantStep={isPlantStep}
//       active={i === trace.idx}
//       onMouseDown={onMouseDown}
//       propertyStatus={propertyStatus}
//       microsteps={i === trace.idx && showMicroSteps}/>;
//   });
// }

// function RTCause(props: {cause?: RT_Event}) {
//   if (props.cause === undefined) {
//     return <></>;
//   }
//   if (props.cause.kind === "timer") {
//     return <div className={styles.inputEvent}>
//       <AccessAlarmIcon fontSize="small"/>
//     </div>;
//   }
//   else if (props.cause.kind === "event") {
//     return <div className={styles.inputEvent}>
//       {props.cause.name}
//       <RTEventParam param={props.cause.param}/>
//     </div>;
//   }
//   // console.log(props.cause);
//   throw new Error("unreachable");
// }

function EventParam(props: {param?: any}) {
  return <>{props.param !== undefined && <>({JSON.stringify(props.param)})</>}</>;
}

// export const RTHistoryItem = memo(function RTHistoryItem({ast, idx, item, prevItem, isPlantStep, active, onMouseDown, propertyStatus, microsteps}: {idx: number, ast: Statechart, item: TraceItem, prevItem?: TraceItem, isPlantStep: boolean, active: boolean, onMouseDown: (idx: number, timestamp: number) => void, propertyStatus: PropertyStatus, microsteps: boolean}) {
//   if (item.kind === "bigstep") {
//     const outputEvents = isPlantStep ? item.state.plant.outputEvents : item.state.sc.outputEvents;
//     return <div
//       className={styles.traceItem + ' ' + (active ? styles.active : "") + ' ' + (isPlantStep ? styles.plantStep : "")}
//       onMouseDown={useCallback(() => onMouseDown(idx, item.simtime), [idx, item.simtime])}>
//       <div>
//         <Status status={propertyStatus}/>
//         &emsp;
//         <Tooltip tooltip="simulated time">{formatTime(item.simtime)}</Tooltip>
//         &emsp;
//         <RTCause cause={isPlantStep ? item.state.plant.inputEvent : item.state.sc.inputEvent}/>
//         {outputEvents.length>0 &&
//           <div style={{display: 'inline-block'}}>&nbsp;&#x2192;&nbsp;
//           {outputEvents.map((e:RaisedEvent) => <span className={styles.outputEvent}>{e.name}<RTEventParam param={e.param}/></span>)}
//           </div>}
//       </div>
//       {/* {!isPlantStep &&
//         <ShowFiredTransitions firedTransitions={
//           [...ast.transitions.values().flatMap(t => t.filter(t => item.state.sc.firedTransitions.includes(t.uid)))]}/>
//       } */}
//       <ShowEnvironment environment={item.state.sc.environment}/>
//       {microsteps && <MicroSteps msgs={item.msgs} />}
//     </div>;
//   }
//   else {
//     // error item
//     return <div
//       className={styles.traceItem
//          + ' ' + styles.runtimeError
//          + ' ' + (active ? styles.active : "")}
//       onMouseDown={useCallback(() => onMouseDown(idx, item.simtime), [idx, item.simtime])}>
//       <div>
//         {formatTime(item.simtime)}
//         &emsp;
//         <div className={styles.inputEvent}><ShowCause cause={item.cause}/></div>
//       </div>
//       <div>
//         {item.error.message}
//       </div>
//       {microsteps && <MicroSteps msgs={item.msgs} />}
//     </div>;
//   }
// });

function MicroSteps({item}: {item: DEVSTraceItem<Statechart2DEVSState>}) {
  return <div style={{
    paddingLeft: 4,
    paddingRight: 4,
    whiteSpace: 'preserve',
    backgroundColor: 'var(--statusbar-bg-color)', // <-- just make it stand out a bit
    borderRadius: '4px', // <-- make it look pretty
    marginTop: 4,
  }}>{item.newState.bigstep.microsteps.map(msg => <div>{msg}</div>)}</div>;
}

function ShowFiredTransitions({firedTransitions}: {firedTransitions: Transition[]}) {
  return <>
    {firedTransitions.map((t, i) => <><ShowTransition key={i} transition={t}/></>)}
  </>
}

function ShowTransition({transition}: {transition: Transition}) {
  if (transition.src === transition.tgt) {
    return <span>
      <span className="activeState">{stateDescription(transition.src)}</span>
      &#x21BA;
    </span>
  }
  else {
    return <span>
      <span className="" style={{border: '1px solid var(--rountangle-stroke-color)', borderRadius: 4, paddingLeft: 2, paddingRight: 2, marginLeft: 2, marginRight: 2}}>{stateDescription(transition.src)}</span>
      &#x21B7;
      <span className="activeState">{stateDescription(transition.tgt)}</span>
      &emsp;
    </span>;
  }
}

// function ShowCause(props: {cause: BigStepCause}) {
//   if (props.cause.kind === "init") {
//     return <></>;
//   }
//   else if (props.cause.kind === "timer") {
//     return <AccessAlarmIcon fontSize="small"/>;
//   }
//   else {
//     return <span>{props.cause.eventName}<RTEventParam param={props.cause.param}/></span>;
//   }
// }

// function ShowEnvironment(props: {environment: Environment}) {
//   return <div>{
//     [...props.environment.entries()]
//       .filter(([variable]) => !variable.startsWith('_'))
//       .map(([variable,value]) => `${variable.split('.').at(-1)}=${JSON.stringify(value)}`).join(', ')
//   }</div>;
// }
