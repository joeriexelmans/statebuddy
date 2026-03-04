import { CoupledDEVSConns, makeCoupledDEVS, Model2ModelConn } from "@/devs/coupled_devs";
import { sc2DEVS, Statechart2DEVSState } from "@/devs/sc2devs";
import { ExtTransitionTrace, restoreTrace } from "@/devs/serialize_trace";
import { DEVSTrace, DEVSTraceItem, makeTracedDEVS } from "@/devs/trace";
import { useShortcuts } from "@/hooks/useShortcuts";
import { Statechart } from "@/statecharts/abstract_syntax";
import { getSimTime, getWallClkDelay, TimeMode } from "@/statecharts/time";
import { useCallback, useEffect, useMemo, useState } from "react";
import { lookupPlant } from "../plants";
import { RuntimeError } from "@/statecharts/interpreter";

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

export function useSimulator(ast: Statechart|null, plantsState: PlantsState, onStep: () => void) {
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});

  // trace is 'null' when there is no ongoing execution
  const [trace, setTrace] = useState<StateBuddyTraceState|null>(null);

  // The currently active item in the execution trace, if there is one
  const currentTraceItem = trace && trace.trace[trace.idx];

  // The current coupled state, if there is one
  const coupledState = currentTraceItem
    && currentTraceItem.newState
    || null;

  const cE = useMemo(() => ast && makeTracedDEVS(makeCoupledDEVS(
    {
      sc: makeTracedDEVS(sc2DEVS(ast)),
      ...Object.fromEntries(plantsState.plants.map(({id, type: plant}) =>
        [id, makeTracedDEVS(lookupPlant(plant)!.execution)])),
    }, {
      inputs: [
        // expose all input events
        ...ast.inputEvents.map(({event}) => ({
          coupledInputEvent: event,
          inputModelName: "sc",
          inputEvent: event,
        })),
      ],
      model2Model: plantsState.conns,
      outputs: [
        // expose all output events
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

  const onInit = useCallback(() => {
    if (cE === null) return;
    const trace = cE.initial();
    setTrace({
      trace,
      idx: 0,
    });
    setTime(time => {
      if (time.kind === "paused") {
        return {...time, simtime: 0};
      }
      else {
        return {...time, since: {simtime: 0, wallclktime: performance.now()}};
      }
    });
    onStep();
  }, [cE, onStep]);

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
        {name: inputEvent, param},
      );
      setTrace({
        trace: newTrace,
        idx: newTrace.length-1, // <-- last (= new) item becomes active
      });
    };
  }, [cE, currentTraceItem, time]);

  // The following effect is what makes timed transitions happen in Statebuddy:
  // timer elapse events are triggered by a change of the simulated time (possibly as a scheduled JS event loop timeout)
  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (trace && currentTraceItem !== null && cE !== null) {
      // we'll look only at the part of the trace until our currently selected item:
      const nextTimeout = cE.timeAdvance(trace.trace.slice(0, trace.idx+1) as DEVSTrace<CoupledState>);

      const makeIntTransition = () => {
        if (trace.idx === trace.trace.length-1) {
          const [outputEvents, newTrace] = cE.intTransition(trace.trace);
          setTrace({
            trace: newTrace,
            idx: newTrace.length - 1,
          });
        }
        else {
          // just advance the index
          // safe as long as execution is deterministic
          setTrace({
            ...trace,
            idx: trace.idx+1,
          });
        }
      }

      if (time.kind === "realtime") {
        const wallclkDelay = getWallClkDelay(time, nextTimeout, Math.round(performance.now()));
        if (wallclkDelay !== Infinity) {
          timeout = setTimeout(makeIntTransition, wallclkDelay);
        }
      }
      else if (time.kind === "paused") {
        if (nextTimeout <= time.simtime) {
          timeout = setTimeout(makeIntTransition, 0);
        }
      }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    }
  }, [cE, time, currentTraceItem]);

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
  const nextWakeup = getNextWakeup(currentTraceItem);
  const lastWakeup = getNextWakeup(trace?.trace.at(-1));

  const endOfTime = trace?.trace.at(-1)?.simtime || Infinity;

  return {trace, setTrace, onInit, onClear, onBack, onRaise, onReplayTrace, time, setTime, nextWakeup, currentTraceItem, coupledState, cE, endOfTime, lastWakeup};
}

function getNextWakeup(item: DEVSTraceItem<CoupledState> | null | undefined) {
  const timers = item?.newState.sc.at(-1)!.newState.bigstep.timers || [];
  const nextTimedTransition = timers[0];
  const nextWakeup = nextTimedTransition?.[0] || Infinity;
  return nextWakeup;
}
