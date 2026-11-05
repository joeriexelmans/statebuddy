import { SC2DEVSNonError, SC2DEVSState } from "@/languages/devs/sc2devs";
import { restoreTrace, restoreTraceIncremental } from "@/languages/devs/serialize_trace";
import { ExtTransitionTrace } from "../migrations/v1_types";
import { DEVSTrace, DEVSTraceItem } from "@/languages/devs/trace";
import { useShortcuts } from "@/hooks/useShortcuts";
import { getSimTime, getWallClkDelay, TimeMode, timeTravel } from "@/App/time";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { RuntimeError } from "@/languages/statecharts/interpreter/interpreter";
import { DEVSComponent } from "@/languages/devs/devs";
import { DeepSetter, WithSetters } from "../../util/partial_setter";
import { TraceableError } from "@/languages/statecharts/parser/parser";
import { RaisedEvent, Mode } from "@/languages/statecharts/interpreter/runtime_types";
import { getEnterDefaultArrows, getFairStepArrows } from "@/languages/statecharts/interpreter/trace_types";
import { isSCOutputStep } from "../Trace/SC2DEVSTrace";
import { useIncrementalMemo } from "@/hooks/useIncrementalMemo";
import { InteractiveExecutionState } from "../migrations/v2_types";

// In StateBuddy, currently, the state of our simulation is always a CoupledDEVS state of our statechart model (with a DEVS adapter around it) and a bunch of 'plants'.
// Perhaps in the future, we could let the user arbitrarily configure this setup (anything on the spectrum from a single Statechart Atomic DEVS to many nested Coupled DEVS ...), but for now, it is what it is.
export type CoupledState = {
  sc: DEVSTrace<SC2DEVSState, RaisedEvent>, // <-- there's always our Statechart execution state ...
} & {
  // ... and a bunch (0..*) of plants:
  [plantName: string]: DEVSTrace<any, any>, // <-- plant state is a black box?
};

// The 'state' of the currently active trace.
export type StateBuddyTraceState = {
  trace: DEVSTrace<CoupledState, RaisedEvent>, // <-- the execution trace
  idx: number, // <-- currently selected trace item
};

export type SimulatorCallbacks = {
  onInit: () => void;
  onClear: () => void;
  onBack: () => void;
  onRaise: (bagOfInputs: RaisedEvent[]) => void;
  onSkip: () => void;
  onReplayTrace: (extTrace: ExtTransitionTrace) => void;

  addOutputListener: (l: OutputListener) => void;
  rmOutputListener: (l: OutputListener) => void;
}

export type SimulatorStuff = WithSetters<{
  time: TimeMode;
}> & {
  trace?: StateBuddyTraceState;
  currentTraceItem?: DEVSTraceItem<CoupledState, RaisedEvent>;
  selectItem: (idx: number) => void;
  nextWakeup?: number;
  runtimeErrors: TraceableError[],
  highlightActive: Mode, // <-- active states
  highlightTransitions: string[], // <-- fired transitions

  // 'reducers'
  simulatorCallbacks: SimulatorCallbacks;
};

type OutputListener = (bagOfOutputs: RaisedEvent[]) => void;

function traceItemTimestamp(item: DEVSTraceItem<any, any> | undefined) {
  return item ? item.simtime : Infinity;
}

function currentTraceIdx(time: TimeMode, trace: DEVSTrace<CoupledState, RaisedEvent>) {
  // trace is a simtime-sorted list, so we perform a binary search :)
  let leftMostIdx = 0;
  let rightMostIdx = trace.length-1;
  let bias = 'R';
  const toFind = getSimTime(time, Date.now());
  while (true) {
    let middleIdx;
    if (bias === 'R') {
      // make the common case fast:
      // often, when calling this function, the current element will be the last one in the list
      middleIdx = rightMostIdx;
    }
    else {
      // normal binary search: divide list in the middle
      middleIdx = Math.floor((leftMostIdx + rightMostIdx) / 2);
    }
    const middleIdxTs = traceItemTimestamp(trace[middleIdx]);
    if (toFind >= middleIdxTs) {
      if (toFind < traceItemTimestamp(trace[middleIdx+1])) {
        return middleIdx; // found it :)
      }
      leftMostIdx = middleIdx+1;
    }
    else {
      rightMostIdx = middleIdx-1;
    }
    // continue with normal binary search
    bias = 'M';
  }
}

export function useInteractiveSimulator(
  cE: DEVSComponent<DEVSTrace<CoupledState, RaisedEvent>, RaisedEvent> | undefined,
  interactive: InteractiveExecutionState,
  setInteractive: DeepSetter<InteractiveExecutionState>,
): SimulatorStuff {

  const computeFresh = (interactive: InteractiveExecutionState) => {
    if (interactive.trace && cE) {
      // console.log('restore fresh');
      const trace = restoreTrace(interactive.trace, cE) as DEVSTrace<CoupledState, RaisedEvent>;
      return {
        trace,
        idx: interactive.idx < 0 ? trace.length-1 : interactive.idx,
      } as StateBuddyTraceState;
    }
  };

  const computeIncremental = (oldPersistentState: InteractiveExecutionState, newPersistentState: InteractiveExecutionState, oldUIState: StateBuddyTraceState | undefined) => {
    if (oldPersistentState === newPersistentState) return oldUIState; // no change, use memoized value
    if (oldPersistentState.trace && newPersistentState.trace) {
      // If old input trace is prefix of new input trace, we can just continue executing our existing fully computed trace
      // Doing this check requires comparing every element in old trace with its corresponding element in new trace, with time complexity = O(N).
      // However, since every execution state contains its own complete history, it is enough to compare the last items:
      if (oldPersistentState.trace.trace[oldPersistentState.trace.trace.length-1] === newPersistentState.trace.trace[oldPersistentState.trace.trace.length-1]) {
        // console.log('restore incremental');
        const trace = restoreTraceIncremental(oldUIState!.trace,
          newPersistentState.trace.trace.slice(oldPersistentState.trace.trace.length), 
          newPersistentState.trace.lastSimTime, cE!);
        return {
          trace,
          idx: interactive.idx < 0 ? trace.length-1 : interactive.idx,
        };
      }
    }
    return computeFresh(newPersistentState);
  }

  const trace = useIncrementalMemo(computeIncremental, computeFresh, interactive);

  // For the simulation to have side effects, output listeners can be registered.
  const [outputListeners, setOutputListeners] = useState<OutputListener[]>([]);


  const addOutputListener = useCallback((l: OutputListener) => {
    setOutputListeners(ls => [...ls, l]);
  }, [setOutputListeners]);

  const rmOutputListener = useCallback((l: OutputListener) => {
    setOutputListeners(ls => ls.filter(ll => ll !== l));
  }, [setOutputListeners]);

  const notifyListeners = useCallback((bagOfOutputs: RaisedEvent[]) => {
    outputListeners.forEach(l => {
      l(bagOfOutputs);
    });
  }, [outputListeners]);

  // The currently active item in the execution trace, if there is one
  const currentTraceItem = trace && trace.trace[trace.idx];
  
  // the timeAdvance of the currently selected item in the trace
  const nextWakeup = infinityIfUndefined(trace && cE?.timeAdvance(trace.trace.slice(0, trace.idx+1) as DEVSTrace<CoupledState, RaisedEvent>));

  const currentSC = currentTraceItem?.newState.sc.at(-1)!.newState;

  const {runtimeErrors, highlightActive, highlightTransitions} = useMemo(() => {
    const state = currentSC?.state;
    if (state instanceof RuntimeError) {
      const runtimeErrors = state.highlight.map((shapeUid) => ({
        shapes: [shapeUid],
        message: state.message,
      } as TraceableError));
      return {
        runtimeErrors,
        highlightActive: new Set as Mode,
        highlightTransitions: [] as string[],
      };
    }
    else {
      let currentBigStep = state;
      const highlightActive = (currentBigStep && currentBigStep.rtconfig.mode) || new Set<string>();
      const highlightTransitions = [] as string[];
      if (currentBigStep) {
        const trace = currentTraceItem?.newState.sc;
        if (trace && isSCOutputStep(trace)) {
          currentBigStep = trace.at(-2)!.newState.state as SC2DEVSNonError;
        }
        if (currentBigStep.kind === "init") {
          highlightTransitions.push(...getEnterDefaultArrows(currentBigStep.enteredRoot));
          console.log({highlightTransitions});
        }
        highlightTransitions.push(...currentBigStep.fairSteps.flatMap(step => getFairStepArrows(step)));
      }
      return {
        runtimeErrors: [] as TraceableError[],
        highlightActive,
        highlightTransitions,
      };
    };
  }, [currentSC]);

  // Simulator callbacks...

  // keep making intTransitions as long as they don't advance the simtime
  // const makeImminentTransitions = useCallback((trace: StateBuddyTraceState) => {
  //   let i=0;
  //   while (true) {
  //     if (i > 1000) {
  //       throw new Error("too many steps - probably an infinite loop :(");
  //     }
  //     const simtime = trace.trace[trace.idx].simtime;
  //     const nextWakeup = cE!.timeAdvance(trace.trace);
  //     if (nextWakeup > simtime) {
  //       return trace;
  //     }
  //     else {
  //       const [outputEvents, newTrace] = cE!.intTransition(trace.trace);
  //       notifyListeners(outputEvents);
  //       trace = {
  //         trace: newTrace,
  //         idx: trace.idx + 1,
  //       }
  //     }
  //     i++;
  //   }
  // }, [cE, notifyListeners]);

  const onInit = useCallback(() => {
    setInteractive._setShallow(interactive => ({
      trace: {
        trace: [],
        lastSimTime: 0,
      },
      time: interactive.time.kind === "paused"
        ? {kind: "paused", simtime: 0}
        : {kind: "realtime", since: {simtime: 0, wallclktime: Date.now()}, scale: interactive.time.scale},
      idx: 0,
    }));
  }, [setInteractive]);

  const onClear = useCallback(() => {
    setInteractive._setShallow({
      trace: undefined,
      time: {kind: "paused", simtime: 0},
      idx: 0,
    });
  }, [setInteractive]);

  // raise input event at current point in simulated time (depends on 'time'), producing a new runtime configuration (or a runtime error)
  const onRaise = useCallback((bagOfInputs: RaisedEvent[]) => {
    setInteractive._setShallow(interactive => {
      const simtime = getSimTime(interactive.time, Math.round(Date.now()));
      let numExtTransitions = 0;
      if (trace) {
        for (let i=0; i<=trace.idx; i++) {
          if (trace.trace[i].kind === "extTransition") numExtTransitions++;
        }
      }
      return {
        trace: interactive.trace && {
          trace: [
              ...interactive.trace.trace.slice(0, numExtTransitions),
              {bagOfInputs, simtime},
            ],
          lastSimTime: simtime,
        },
        // advance time if paused:
        time: interactive.time.kind === "paused" ? {
          kind: "paused" as const,
          simtime: simtime,
        } : interactive.time, // <-- don't advance time if realtime (time is already advancing)
        idx: -1,
      };
    });
  }, [setInteractive, trace]);

  // Sets the simulated time to exactly match the next timed transition.
  // Note: this function does not make the next timed transition happen. You need to call `makeNextTimedTransition` for that.
  const jumpTimeToNextTimedTransition = useCallback(() => {
    setInteractive._setShallow(interactive => {
      return {
        trace: interactive.trace && {
          trace: interactive.trace.trace,
          lastSimTime: nextWakeup,
        },
        time: interactive.time.kind === "paused"
          ? {
              kind: "paused",
              simtime: nextWakeup,
            }
          : interactive.time, // <-- for realtime, time mode remains unchanged (clock already naturally advancing)
        idx: interactive.idx+1,
      }
    });
  }, [setInteractive, nextWakeup]);

  // when user pressed Tab
  const onSkip = useCallback(() => {
    if (nextWakeup !== Infinity) {
      jumpTimeToNextTimedTransition();
      const setTime = setInteractive.setTime._setShallow as Dispatch<SetStateAction<TimeMode>>;
      setTime(time => timeTravel(time, nextWakeup, Date.now()));
    }
  }, [jumpTimeToNextTimedTransition, nextWakeup]);

  // The following effect is what makes timed transitions happen in Statebuddy:
  // timer elapse events are triggered by a change of the simulated time (possibly as a scheduled JS event loop timeout)
  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (interactive.time.kind === "realtime") {
      const wallclkDelay = getWallClkDelay(interactive.time, nextWakeup, Math.round(Date.now()));
      if (wallclkDelay !== Infinity) {
        timeout = setTimeout(jumpTimeToNextTimedTransition, wallclkDelay);
      }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    }
  }, [interactive, nextWakeup, jumpTimeToNextTimedTransition]);

  const onBack = useCallback(() => {
    if (trace) {
      const prevItem = trace.trace[trace.idx-1];
      const prevSimtime = prevItem ? prevItem.simtime : 0;
      setInteractive._setShallow(interactive => ({
        trace: interactive.trace,
        time: {
          kind: "paused",
          simtime: prevSimtime,
        },
        idx: trace.idx-1 >= 0 ? trace.idx-1 : 0,
      }))
    }
  }, [trace]);

  const onNext = useCallback(() => {
    if (trace) {
      const nextItem = trace.trace[trace.idx+1] || trace.trace[trace.idx];
      setInteractive._setShallow(interactive => ({
        trace: interactive.trace,
        time: {
          kind: "paused",
          simtime: nextItem.simtime,
        },
        idx: trace.idx+1 < trace.trace.length ? trace.idx+1 : trace.idx,
      }));
    }
  }, [trace]);

  const selectItem = useCallback((idx: number) => {
    setInteractive._setShallow(interactive => ({
      trace: interactive.trace,
      time: {
        kind: "paused",
        simtime: trace?.trace[idx].simtime || 0,
      },
      idx: idx,
    }))
  }, [trace]);

  useShortcuts([
    {keys: ["ArrowUp"], action: onBack},
    {keys: ["ArrowDown"], action: onNext},
  ])

  const onReplayTrace = useCallback((extTrace: ExtTransitionTrace) => {
    setInteractive._setShallow(_ => {
      return {
        trace: extTrace,
        time: {
          kind: "paused",
          simtime: extTrace.lastSimTime,
        },
        idx: -1,
      }
    })
  }, [setInteractive]);

  const simulatorCallbacks = useMemo(() => ({
    onInit, onClear, onBack, onRaise, onSkip, onReplayTrace, addOutputListener, rmOutputListener,
  }), [onInit, onClear, onBack, onRaise, onSkip, onReplayTrace, addOutputListener, rmOutputListener]);

  const simulator = useMemo(() => ({
      time: interactive.time,
      setTime: setInteractive.setTime._setShallow as Dispatch<SetStateAction<TimeMode>>,
      trace,
      currentTraceItem,
      selectItem,
      nextWakeup,
      runtimeErrors,
      highlightActive,
      highlightTransitions,

      // 'reducers'
      simulatorCallbacks,
  }), [cE, trace, outputListeners]);

  return simulator;
}

// helpers ....

export function infinityIfUndefined(simtime: number | null | undefined | false) {
  // we cannot just return (simtime || Infinity) because simtime === 0 will become Infinity and we don't want that!
  if (simtime === null || simtime === undefined || simtime === false) {
    return Infinity;
  }
  else return simtime;
}
