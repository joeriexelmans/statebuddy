import { Statechart2DEVSState } from "@/devs/sc2devs";
import { ExtTransitionTrace, restoreTrace } from "@/devs/serialize_trace";
import { DEVSTrace, DEVSTraceItem } from "@/devs/trace";
import { useShortcuts } from "@/hooks/useShortcuts";
import { getSimTime, getWallClkDelay, TimeMode } from "@/statecharts/time";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RuntimeError } from "@/statecharts/interpreter";
import { DEVSComponent } from "@/devs/devs";
import { WithSetters } from "../makePartialSetter";

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

export type SimulatorCallbacks = {
  onInit: () => void;
  onClear: () => void;
  onBack: () => void;
  onRaise: (_inputEvent: string, _param: any) => void;
  onSkip: () => void;
  onReplayTrace: (extTrace: ExtTransitionTrace) => void;
}

export type SimulatorStuff = WithSetters<{
  // simulator volatile state
  time: TimeMode;
  trace?: StateBuddyTraceState;
}> & {
  // derived from state (shorthand)
  currentTraceItem?: DEVSTraceItem<CoupledState>;
  nextWakeup?: number;

  // 'reducers'
  simulatorCallbacks: SimulatorCallbacks;
};

export function useSimulator(cE: DEVSComponent<DEVSTrace<CoupledState>> | undefined): SimulatorStuff {
  // time mode of the simulator
  const [time, setTime] = useState<TimeMode>({kind: "paused", simtime: 0});
  // trace is 'null' when there is no ongoing execution
  const [trace, setTrace] = useState<StateBuddyTraceState|undefined>(undefined);

  // The currently active item in the execution trace, if there is one
  const currentTraceItem = trace && trace.trace[trace.idx];
  
  // the timeAdvance of the currently selected item in the trace
  const nextWakeup = infinityIfUndefined(trace && cE?.timeAdvance(trace.trace.slice(0, trace.idx+1) as DEVSTrace<CoupledState>));


  // const timeRelatedStuff = useMemo(() => currentTraceItem && {
  //   simtime: currentTraceItem.simtime,
  //   nextWakeup,
  //   lastWakeup,
  //   endOfTime,
  // }, [trace]);


  // Simulator callbacks...

  const onInit = useCallback(() => {
    if (cE === undefined) return;
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
    setTrace(undefined);
    setTime({kind: "paused", simtime: 0});
  }, [setTrace, setTime]);

  // raise input event at current point in simulated time (depends on 'time'), producing a new runtime configuration (or a runtime error)
  const onRaise = useMemo(() => {
    if (cE === undefined || currentTraceItem === undefined) {
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
    if (trace && currentTraceItem && cE) {
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
    if (trace && currentTraceItem && cE) {
      if (time.kind === "realtime") {
        const nextTimeout = cE.timeAdvance(trace.trace.slice(0, trace.idx+1) as DEVSTrace<CoupledState>);
        const wallclkDelay = getWallClkDelay(time, nextTimeout, Math.round(performance.now()));
        if (wallclkDelay !== Infinity) {
          timeout = setTimeout(makeNextTimedTransition, wallclkDelay);
        }
      }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    }
  }, [cE, time, currentTraceItem, makeNextTimedTransition]);

  const onBack = useCallback(() => {
    if (trace !== undefined && trace.idx > 0) {
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
    if (trace !== undefined && trace.idx < trace.trace.length -1) {
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

  const simulatorCallbacks = useMemo(() => ({
    onInit, onClear, onBack, onRaise, onSkip, onReplayTrace,
  }), [onInit, onClear, onBack, onRaise, onSkip, onReplayTrace]);

  const simulator = useMemo(() => {
    return {
      // state
      trace,
      setTrace,
      time,
      setTime,

      // derived from state (shorthand)
      currentTraceItem,
      nextWakeup,

      // 'reducers'
      simulatorCallbacks,
    };
  }, [cE, time, trace]);

  return simulator;
}

// helpers ....

const ignoreRaise = (_inputEvent: string, _param: any) => {};

export function infinityIfUndefined(simtime: number | null | undefined) {
  // we cannot just return (simtime || Infinity) because simtime === 0 will become Infinity and we don't want that!
  if (simtime === null || simtime === undefined) {
    return Infinity;
  }
  else return simtime;
}
