import styles from "./Trace.module.css";

import { whoMadeExtTransition, whoMadeIntTransition } from "@/devs/coupled_trace";
import { DEVSTrace, DEVSTraceItem, DEVSTraceItemExtTransition, DEVSTraceItemInit, DEVSTraceItemIntTransition } from "@/devs/trace";
import { actionLangValToText } from "@/statecharts/actionlang_prettyprinter";
import { RuntimeError } from "@/statecharts/interpreter";
import { TraceInit } from "@/statecharts/microstep_trace_types";
import { RaisedEvent } from "@/statecharts/runtime_types";
import NotInterestedIcon from '@mui/icons-material/NotInterested';
import { Dispatch, memo, SetStateAction, useEffect } from "react";
import { Statechart } from "../../statecharts/abstract_syntax";
import { TimeMode } from "../../statecharts/time";
import { formatTime, objectsEqual } from "../../util/util";
import { Column } from "../Components/Column";
import { Row } from "../Components/Row";
import { StatusType } from "../Components/StatusIndicator";
import { Tooltip } from "../Components/Tooltip";
import { CoupledState, StateBuddyTraceState } from "../hooks/useSimulator";
import { WithSetters } from "../makePartialSetter";
import { PlantsState } from "../migrations/v1_types";
import { TraceView } from "../migrations/v2_types";
import { statebuddyPlants } from "../plants";
import { PropertyTrace } from "../SideBar/prepare_trace_types";
import { PropertyStatusIndicator } from "../SideBar/PropertyStatusIndicator";
import { InitCause, InputCause, TimerCause } from "./Common";
import { isSCOutputStep, SCBigStepTrace, SCInitializationTrace } from "./SC2DEVSTrace";

type TraceProps = WithSetters<{
  currentTrace: StateBuddyTraceState,
}> & {
  traceView: TraceView,

  // clicking on an item in the trace will jump to it so we need to set the time to that point.
  setTime: Dispatch<SetStateAction<TimeMode>>,

  ast: Statechart,

  // result of checking a property is a trace of booleans which we display in the trace
  propertyTrace?: PropertyTrace,
  plantsState: PlantsState,
}

// Things are a bit funny here. We want to render the execution history of our Statechart, but we have a Coupled DEVS trace containing all the steps made by both the Statechart and the plant(s). We offer the user to hide steps made by the plant(s).
export const CoupledDEVSTrace = memo(function CoupledDEVSTrace({
  currentTrace, setCurrentTrace,
  setTime,
  ast,
  traceView: {
    autoScroll,
  },
  propertyTrace,
  plantsState,
}: TraceProps) {
  // Auto-scroll when trace item changes
  useEffect(() => {
    if (autoScroll) {
      // because effects run *after* re-render, we should find our possibly newly added trace item with the following querySelector:
      const el = document.querySelector(`#traceItem-${currentTrace.idx}`);
      el?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
        // @ts-ignore
        container: "nearest", // <-- only scroll the innermost scrollable view - not supported in FF :(
      });
    }
  }, [currentTrace.idx]);

  let j=0;
  return <div>
    {currentTrace.trace.map((item, i) => {
      const prevItem = currentTrace.trace[i-1];

      let satisfied;
      [j, satisfied] = lookupPropertyStatus(item.simtime, propertyTrace || [], j);
      let propertyStatus: StatusType = "pending";
      if (satisfied !== null && satisfied !== undefined) {
        propertyStatus = (satisfied ? "ok" : "nok");
      }

      return <div
          key={i}
          id={`traceItem-${i}`}
          className={styles.traceItem
                    + ' ' + ((currentTrace.idx === i) ? styles.active : "")
                    }
          onMouseDown={e => {
            if (e.button === 0) {
              setCurrentTrace(trace => ({trace: trace.trace, idx: i}));
              setTime(_ => ({kind: "paused", simtime: item.simtime}));
            }
          }}
        >
        <div style={{display: 'flex', gap: '1em'}}>
          <div style={{minWidth: 22, textAlign: 'right'}}>#{i}</div>
          <CoupledDEVSTraceItem
            item={item}
            prevItem={prevItem}
            status={propertyStatus}
            plantsState={plantsState}
            ast={ast}
          />
        </div>
      </div>;
    })}
  </div>;
}, objectsEqual);

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

function TraceItemHeader({status, simtime, isOutputStep}: {status: StatusType, simtime: number, isOutputStep: boolean}) {
  return <>
    {/* property check result */}
    <div style={{visibility: isOutputStep ? "hidden" : undefined}}>
      <PropertyStatusIndicator status={status}/>
    </div>

    {/* timestamp */}
    <div style={{minWidth: 38, textAlign: 'center'}}>
      <Tooltip align="left" tooltip={isOutputStep ? "In the previous step, a DEVS component wanted to output events while making an external transition (not possible in DEVS). Therefore, in this step, the same component makes an internal transition to output those events." : "timestamp"}>
        <div style={{textAlign: 'right'}}>
          {isOutputStep ? '＝' : formatTime(simtime)}
        </div>
      </Tooltip>
    </div>
  </>;
}

function lookupName(plantsState: PlantsState, plantId: string) {
  return plantsState.plants.find(({id}) => id === plantId)?.name || plantId;
}

type ThingsToPassOn = {
  plantsState: PlantsState,
  ast: Statechart,
}

const CoupledDEVSTraceItem = memo(function CoupledDEVSTraceItem({item, prevItem, status, ...thingsToPassOn}: {
  item: DEVSTraceItem<CoupledState, RaisedEvent>,
  prevItem: DEVSTraceItem<CoupledState, RaisedEvent>,
  status: StatusType,
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
}, objectsEqual); // <-- just a shallow comparison already saves us a lot of re-renders

// DEVS components can be statechart instances (white-box -> we show microsteps), or generic (black-box)
function isComponentStatechart(componentId: string, plantsState: PlantsState, ast: Statechart) {
  if (componentId === "sc") {
    return ast;
  }
  const plantType = plantsState.plants.find(({id}) => id === componentId)?.type;
  if (plantType) {
    return statebuddyPlants[plantType].as;
  }
}

function DEVSRuntimeError({error}: {error: RuntimeError}) {
  return <>
    <span style={{
      backgroundColor: 'var(--error-bg-color',
      color: 'var(--error-color)',
      borderRadius: '4px', // <-- make it look pretty
      paddingLeft: 4,
      paddingRight: 4,
    }}>
      {error.message}
    </span>
  </>;
}

function CoupledDEVSInitialization({item, status, plantsState, ast}: {
  item: DEVSTraceItemInit<CoupledState>,
  status: StatusType,
} & ThingsToPassOn) {
  // just show the initialization of every component:
  return <>
    <TraceItemHeader isOutputStep={false} simtime={0} status={status} />
    {Object.entries(item.newState).map(([componentId, componentTrace]) => {
      const componentTraceItem = componentTrace.at(-1)!;
      const error = getRuntimeError(componentTraceItem);
      const plant = plantsState.plants.find(({id}) => id === componentId);
      const componentDisplayName = plant?.name || componentId;
      const statechart = isComponentStatechart(componentId, plantsState, ast);
      return <Row key={componentId}>
        <div>{componentDisplayName}</div>
        <Column>
          {error && <DEVSRuntimeError error={error} />
                 || (statechart && <SCInitializationTrace init={componentTraceItem.newState.state as TraceInit}/>
                                || <InitCause/>)}
        </Column>
      </Row>;
    })}
  </>;
}

// An internal transition step made by Coupled DEVS
function CoupledDEVSInternalTransition({item, prevItem, status, plantsState, ast}: {
  item: DEVSTraceItemIntTransition<CoupledState, RaisedEvent>,
  prevItem: DEVSTraceItem<CoupledState, RaisedEvent>,
  status: StatusType,
} & ThingsToPassOn) {
  // one component will have made 1 intTransition, and some other components may have made 1 extTransition.
  const componentMadeIntTransition = whoMadeIntTransition([prevItem, item]);
  const blessedTrace = item.newState[componentMadeIntTransition];
  const blessedItem = blessedTrace.at(-1)! as DEVSTraceItemIntTransition<any, RaisedEvent>;
  const blessedStatechart = isComponentStatechart(componentMadeIntTransition, plantsState, ast);
  const isOutputStep = Boolean(blessedStatechart && isSCOutputStep(blessedTrace));
  const error = getRuntimeError(blessedItem);

  return <>
    {/* header */}
    <TraceItemHeader isOutputStep={isOutputStep} simtime={item.simtime} status={status}/>

    {/* first we show the component that made the intTransition */}
    <Row>
      <div>{lookupName(plantsState, componentMadeIntTransition)}</div>
      {error && <DEVSRuntimeError error={error} />
             || <>
                  {blessedStatechart && <SCBigStepTrace bigstep={blessedItem.newState.state}/>
                                      || <TimerCause/>}
                  {blessedItem.outputEvents.map(o => <DEVSRaisedOutputEvent event={o}/>)}
                </>}
    </Row>

    {/* then we show the components that made an extTransition */}
    <DEVSExternalTransitions
      components={Object.entries(item.newState).filter(([componentId, componentTrace]) => {
        if (componentId === componentMadeIntTransition) {
          // we've already rendered this one
          return false;
        }
        if (prevItem.newState[componentId] === componentTrace) {
          // component did not step
          return false;
        }
        return true;
      })}
      {...{ast, plantsState}}
    />
  </>;
}

function DEVSRaisedOutputEvent({event: {name, param}}: {event: RaisedEvent}) {
  return <Tooltip tooltip='output event' align='left'>
    <div className={styles.outputEvent} >
      &#8599;
      {name}
      {param !== undefined && <>({actionLangValToText(param)})</>}
    </div>
  </Tooltip>
}

function DEVSExternalTransitions({components, plantsState, ast}: {
  components: [string, DEVSTrace<any, any>][],
} & ThingsToPassOn) {
  return components.map(([componentId, componentTrace]) => {
    const item = componentTrace.at(-1)! as DEVSTraceItemExtTransition<any, any>;
    const statechart = isComponentStatechart(componentId, plantsState, ast);
    const error = getRuntimeError(item);
    return <Row key={componentId}>
      <div>{lookupName(plantsState, componentId)}</div>
      {error && <DEVSRuntimeError error={error} />
             || (statechart && <SCBigStepTrace bigstep={item.newState.state}/>
                            || item.bagOfInputs.map(e => <InputCause e={e}/>))}
    </Row>
  });
}

function CoupledDEVSExternalTransition({item, prevItem, status, ...rest}: {
  item: DEVSTraceItemExtTransition<CoupledState, RaisedEvent>,
  prevItem: DEVSTraceItem<CoupledState, RaisedEvent>,
  status: StatusType,
} & ThingsToPassOn) {
  const components = whoMadeExtTransition([prevItem, item]);
  return <>
    <TraceItemHeader isOutputStep={false} simtime={item.simtime} status={status} />
    {(components.length > 0)
      ? <DEVSExternalTransitions components={components} {...rest} />
      // if there was an extTransition, but no component made extTransition, just display the (ignored) bag of inputs:
      : <Column>
          <Tooltip tooltip="External inputs were received, but all components ignored it.">
            <NotInterestedIcon fontSize="small"/>
            {item.bagOfInputs.map(e => <InputCause e={e}/>)}
          </Tooltip>
        </Column>
    }
  </>;
}

function getRuntimeError(item: DEVSTraceItem<any, any>): (RuntimeError | undefined) {
  const e = item.newState.state;
  if (e instanceof RuntimeError) {
    return e;
  }
}
