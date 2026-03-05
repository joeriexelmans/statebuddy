import { CoupledDEVSConns, makeCoupledDEVS, Model2ModelConn } from "@/devs/coupled_devs";
import { sc2DEVS, Statechart2DEVSState } from "@/devs/sc2devs";
import { ExtTransitionTrace, restoreTrace } from "@/devs/serialize_trace";
import { DEVSTrace, DEVSTraceItem, makeTracedDEVS } from "@/devs/trace";
import { useShortcuts } from "@/hooks/useShortcuts";
import { Statechart } from "@/statecharts/abstract_syntax";
import { getSimTime, getWallClkDelay, TimeMode } from "@/statecharts/time";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RuntimeError } from "@/statecharts/interpreter";
import { statebuddyPlants } from "../plants";

// In StateBuddy, currently, the state of our simulation is always a CoupledDEVS state of our statechart model (with a DEVS adapter around it) and a bunch of 'plants'.
// Perhaps in the future, we could let the user arbitrarily configure this setup (anything on the spectrum from a single Statechart Atomic DEVS to many nested Coupled DEVS ...), but for now, it is what it is.
export type CoupledState = {
  sc: DEVSTrace<Statechart2DEVSState>, // <-- there's always our Statechart execution state ...
} & {
  // ... and a bunch (0..*) of plants:
  [plantName: string]: DEVSTrace<any>, // <-- plant state is a black box?
};

// The 'state' of the currently active trace.
export type StateBuddyTraceState = {
  trace: DEVSTrace<CoupledState>, // <-- the execution trace
  idx: number, // <-- currently selected trace item
  runtimeError?: RuntimeError, // <-- certain runtime errors (e.g., non-determinism) are caught and rendered as the last item in the trace
};

// For every plant the user instantiates, we keep the following kind of entry:
export type PlantInstance = {
  id: string, // <-- every plant instance gets a unique immutable ID
  name: string, // <-- a human-readable and editable name for the plant
  type: string, // <-- the plant type ("digital watch", "traffic light", "microwave", ...)
}

// Statebuddy's application state wrt. plants:
// JSON-serializable.
export type PlantsState = {
  plants: PlantInstance[],
  nextPlantID: number,
  conns: Model2ModelConn[], // <-- the user can configure the connections between the different components (meaning: the statechart model and the plant(s))
}

export const defaultPlantsState = {
  plants: [],
  nextPlantID: 0,
  conns: [],
};

const ignoreRaise = (_inputEvent: string, _param: any) => {};

function infinityIfUndefined(simtime: number | null | undefined) {
  // we cannot just return (simtime || Infinity) because simtime === 0 will become Infinity and we don't want that!
  if (simtime === null || simtime === undefined) {
    return Infinity;
  }
  else return simtime;
}

export function useSimulator(ast: Statechart|null, plantsState: PlantsState) {
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});

  // trace is 'null' when there is no ongoing execution
  const [trace, setTrace] = useState<StateBuddyTraceState|null>(null);

  // The currently active item in the execution trace, if there is one
  const currentTraceItem = trace && trace.trace[trace.idx];

  // The current coupled state, if there is one
  const coupledState = currentTraceItem
    && currentTraceItem.newState
    || null;
  
  const plants = plantsState.plants.map(({id, type}) => [id, statebuddyPlants[type]!] as const);

  const cE = useMemo(() => ast && makeTracedDEVS(makeCoupledDEVS(
    {
      sc: makeTracedDEVS(sc2DEVS(ast)),
      ...Object.fromEntries(plants.map(([id, plant]) => [id, makeTracedDEVS(plant.plant.execution)])),
    }, {
      inputs: [
        // expose all input events
        ...ast.inputEvents.map(({event}) => ({
          coupledInputEvent: event,
          inputModelName: "sc",
          inputEvent: event,
        })),
        ...plants.flatMap(([id, plant]) => plant.plant.uiEvents.map(uiEvent => ({
          coupledInputEvent: uiEvent.event,
          inputModelName: id,
          inputEvent: uiEvent.event,
        }))),
      ],
      // the user-configurable part:
      model2Model: plantsState.conns,
      outputs: [
        // Expose all output events of the statechart as outputs of the Coupled DEVS
        // The MTL property checker and the Plot-component will treat these output events as signals.
        ...[...ast.outputEvents].map(event => ({
          outputModelName: "sc",
          outputEvent: event,
          coupledOutputEvent: event,
        })),
      ],
    } as CoupledDEVSConns,
    ast.inputEvents.map(({event}) => event), // <-- every SC input becomes coupled input
    [...ast.outputEvents], // <-- every SC output becomes coupled output
  )),
  [ast, plantsState]);

  // the timeAdvance of the currently selected item in the trace
  const nextWakeup = infinityIfUndefined(trace && cE?.timeAdvance(trace.trace.slice(0, trace.idx+1) as DEVSTrace<CoupledState>));
  // the timeAdvance on the last item in the trace
  const lastWakeup = infinityIfUndefined(trace && cE?.timeAdvance(trace.trace) || Infinity);
  // the simtime of the last item in the trace
  const endOfTime = infinityIfUndefined(trace?.trace.at(-1)?.simtime || Infinity);

  const onInit = useCallback(() => {
    if (cE === null) return;
    const trace = cE.initial();
    setTrace(makeImminentTransitions({
      trace,
      idx: 0,
    }));
    setTime(time => {
      if (time.kind === "paused") {
        return {...time, simtime: 0};
      }
      else {
        return {...time, since: {simtime: 0, wallclktime: performance.now()}};
      }
    });
  }, [cE]);

  const onClear = useCallback(() => {
    setTrace(null);
    setTime({kind: "paused", simtime: 0});
  }, [setTrace, setTime]);

  // raise input event at current point in simulated time (depends on 'time'), producing a new runtime configuration (or a runtime error)
  const onRaise = useMemo(() => {
    if (cE === null || currentTraceItem === null) {
      return ignoreRaise; // this speeds up rendering of components that depend on onRaise if the model is being edited while there is no ongoing trace
    }
    else return (inputEvent: string, param: any) => {
      const simtime = getSimTime(time, Math.round(performance.now()));
      const newTrace = cE.extTransition(
        simtime,
        trace!.trace.slice(0, trace!.idx + 1) as DEVSTrace<CoupledState>,
        [{name: inputEvent, param}],
      );
      setTrace(makeImminentTransitions({
        trace: newTrace,
        idx: newTrace.length-1, // <-- last (= new) item becomes active
      }));
      // setTrace(({
      //   trace: newTrace,
      //   idx: newTrace.length-1, // <-- last (= new) item becomes active
      // }));
    };
  }, [cE, currentTraceItem, time]);

  const makeImminentTransitions = (trace: StateBuddyTraceState) => {
    let i=0;
    while (true) {
      if (i > 1000) {
        throw new Error("too many steps - probably an infinite loop :(");
      }
      const simtime = trace.trace[trace.idx].simtime;
      const nextWakeup = cE!.timeAdvance(trace.trace);
      if (nextWakeup > simtime) {
        return trace;
      }
      else {
        const [_, newTrace] = cE!.intTransition(trace.trace)
        trace = {
          trace: newTrace,
          idx: trace.idx + 1,
        }
      }
      i++;
    }
  };

  const makeNextTimedTransition = useCallback(() => {
    if (trace && currentTraceItem !== null && cE !== null) {
      if (trace.idx === trace.trace.length-1) {
        const [_outputEvents, newTrace] = cE.intTransition(trace.trace);
        setTrace({
          trace: newTrace,
          idx: newTrace.length - 1,
        });
      }
      else {
        // just advance the index
        // this is safe as long as execution is deterministic
        setTrace({
          trace: trace.trace,
          idx: trace.idx+1,
        });
      }
    }
  }, [trace, currentTraceItem, cE, setTrace]);

  // Sets the simulated time to exactly match the next timed transition.
  // Note: this function does not make the next timed transition happen. You need to call `makeNextTimedTransition` for that.
  const setTimeToNextTimedTransition = useCallback(() => {
    if (trace && currentTraceItem !== null && cE !== null && nextWakeup !== Infinity) {
      setTime(time => {
        if (time.kind === "paused") {
          return {
            kind: "paused",
            simtime: nextWakeup,
          }
        }
        else {
          return {
            kind: "realtime",
            scale: time.scale,
            since: {
              simtime: nextWakeup,
              wallclktime: Math.round(performance.now()),
            }
          }
        }
      })
    }
  }, [nextWakeup, setTime, trace, currentTraceItem, cE]);

  const onSkip = useCallback(() => {
    setTimeToNextTimedTransition();
    makeNextTimedTransition();
  }, [setTimeToNextTimedTransition, makeNextTimedTransition]);

  // The following effect is what makes timed transitions happen in Statebuddy:
  // timer elapse events are triggered by a change of the simulated time (possibly as a scheduled JS event loop timeout)
  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (trace && currentTraceItem !== null && cE !== null) {
      if (time.kind === "realtime") {
        const nextTimeout = cE.timeAdvance(trace.trace.slice(0, trace.idx+1) as DEVSTrace<CoupledState>);
        const wallclkDelay = getWallClkDelay(time, nextTimeout, Math.round(performance.now()));
        if (wallclkDelay !== Infinity) {
          timeout = setTimeout(makeNextTimedTransition, wallclkDelay);
        }
      }
      // else if (time.kind === "paused") {
      //   if (nextTimeout <= time.simtime) {
      //     // timeout = setTimeout(makeIntTransition, 0);
      //   }
      // }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    }
  }, [cE, time, currentTraceItem, makeNextTimedTransition]);

  const onBack = useCallback(() => {
    if (trace !== null && trace.idx > 0) {
      setTime({
        kind: "paused",
        simtime: trace.trace[trace.idx-1].simtime,
      });
      setTrace({
        ...trace,
        idx: trace.idx-1,
      });
    }
  }, [trace, trace?.idx, setTime, setTrace]);

  const onNext = useCallback(() => {
    if (trace !== null && trace.idx < trace.trace.length -1) {
      setTime({
        kind: "paused",
        simtime: trace.trace[trace.idx+1].simtime,
      });
      setTrace({
        ...trace,
        idx: trace.idx+1,
      });
    }
  }, [trace, trace?.idx, setTrace]);

  useShortcuts([
    {keys: ["ArrowUp"], action: onBack},
    {keys: ["ArrowDown"], action: onNext},
  ])

  const onReplayTrace = useCallback((extTrace: ExtTransitionTrace) => {
    if (cE) {
      const trace = restoreTrace(extTrace, cE);
      setTrace({trace, idx: trace.length-1});
      setTime({kind: "paused", simtime: extTrace.lastSimTime});
    }
  }, [cE]);

  // timestamp of next timed transition, in simulated time
  // const nextWakeup = getNextWakeup(currentTraceItem);
  // const lastWakeup = getNextWakeup(trace?.trace.at(-1));

  return {trace, setTrace, onInit, onClear, onBack, onRaise, onSkip, onReplayTrace, time, setTime, nextWakeup, currentTraceItem, coupledState, cE, endOfTime, lastWakeup};
}

// function getNextWakeup(item: DEVSTraceItem<CoupledState> | null | undefined) {
//   const timers = item?.newState.sc.at(-1)!.newState.bigstep.timers || [];
//   const nextTimedTransition = timers[0];
//   const nextWakeup = nextTimedTransition?.[0] || Infinity;
//   return nextWakeup;
// }
