import { SC2DEVSNonError, SC2DEVSState } from "@/languages/devs/sc2devs";
import { restoreTrace, restoreTraceIncremental } from "@/languages/devs/serialize_trace";
import { ExtTransitionTrace } from "../migrations/v1_types";
import { DEVSTrace, DEVSTraceItem } from "@/languages/devs/trace";
import { useShortcuts } from "@/hooks/useShortcuts";
import { getSimTime, getWallClkDelay, TimeMode, timeTravel } from "@/App/time";
import { Dispatch, SetStateAction, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { RuntimeError } from "@/languages/statecharts/interpreter/interpreter";
import { DEVSComponent } from "@/languages/devs/devs";
import { DeepSetter, WithSetters } from "../../util/partial_setter";
import { TraceableError } from "@/languages/statecharts/parser/parser";
import { RaisedEvent, Mode } from "@/languages/statecharts/interpreter/runtime_types";
import { getEnterDefaultArrows, getFairStepArrows } from "@/languages/statecharts/interpreter/trace_types";
import { isSCOutputStep } from "../Trace/SC2DEVSTrace";
import { useIncrementalMemo } from "@/hooks/useIncrementalMemo";
import { InteractiveExecutionState } from "../migrations/v2_types";
import { NowContext } from "../NowContext";

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

export function sliceIfNecessary<T>(arr: T[], start: number, end?: number) {
  if (start === 0 && arr.length === end) return arr;
  return arr.slice(start, end);
}

export function useInteractiveSimulator(
  cE: DEVSComponent<DEVSTrace<CoupledState, RaisedEvent>, RaisedEvent> | undefined,
  interactive: InteractiveExecutionState,
  setInteractive: DeepSetter<InteractiveExecutionState>,
): SimulatorStuff {
  const now = useContext(NowContext);

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
      const maxLen = Math.max(oldPersistentState.trace.trace.length, newPersistentState.trace.trace.length);
      const commonOld = sliceIfNecessary(oldPersistentState.trace.trace, 0, maxLen);
      const commonNew = sliceIfNecessary(newPersistentState.trace.trace, 0, maxLen);
      // Now we check if old is a prefix of new, or vice versa:
      // Note that we only need to compare the last trace item. This is because each trace item is of type DEVSTrace, hence containing its own complete history.
      if (commonOld.at(-1) === commonNew.at(-1)) {
        // console.log('incremental restore');
        const keepUntilIdx = oldUIState!.trace.findLastIndex(el => {
          return el.simtime <= newPersistentState.trace!.lastSimTime;
        });
        const keep = sliceIfNecessary(oldUIState!.trace, 0, keepUntilIdx+1);
        const trace = restoreTraceIncremental(keep,
          sliceIfNecessary(oldPersistentState.trace.trace, maxLen), // <-- It doesn't matter if we use commonOld or commonNew. They are the same.
          newPersistentState.trace.lastSimTime, cE!);
        return {
          trace,
          idx: interactive.idx < 0 ? trace.length-1 : interactive.idx,
        };
      }
    }
    return computeFresh(newPersistentState);
  }

  // "full trace" == what you see in the "execution traces" panel
  const fullTrace = useIncrementalMemo(computeIncremental, computeFresh, interactive);

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
  const currentTraceItem = fullTrace && fullTrace.trace[fullTrace.idx];
  
  // the timeAdvance of the currently selected item in the trace
  const nextWakeup = infinityIfUndefined(fullTrace && cE?.timeAdvance(fullTrace.trace.slice(0, fullTrace.idx+1) as DEVSTrace<CoupledState, RaisedEvent>));

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

  const onInit = useCallback(() => {
    setInteractive._setShallow(interactive => ({
      trace: {
        trace: [],
        lastSimTime: 0,
      },
      time: interactive.time.kind === "paused"
        ? {kind: "paused", simtime: 0}
        : {kind: "realtime", since: {simtime: 0, wallclktime: now()}, scale: interactive.time.scale},
      idx: -1,
    }));
  }, [setInteractive._setShallow, now]);

  const onClear = useCallback(() => {
    setInteractive._setShallow({
      trace: undefined,
      time: {kind: "paused", simtime: 0},
      idx: 0,
    });
  }, [setInteractive._setShallow]);

  const forgetFuture = useCallback(() => {
    let numExtTransitions = 0;
    if (fullTrace) {
      numExtTransitions = fullTrace.trace[fullTrace.idx].numExtTransitions;
    }
    return sliceIfNecessary(interactive.trace!.trace, 0, numExtTransitions);
  }, [fullTrace, interactive.trace]);

  // raise input event at current point in simulated time (depends on 'time'), producing a new runtime configuration (or a runtime error)
  const onRaise = useCallback((bagOfInputs: RaisedEvent[]) => {
    setInteractive._setShallow(interactive => {
      const simtime = getSimTime(interactive.time, Math.round(now()));
      return {
        trace: interactive.trace && {
          trace: [
              ...forgetFuture(),
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
  }, [setInteractive._setShallow, fullTrace, now, forgetFuture]);

  // Updates the current execution trace such that the next timed transition is appended.
  const jumpTimeToNextTimedTransition = useCallback(() => {
    setInteractive._setShallow(interactive => {
      return {
        trace: interactive.trace && {
          trace: forgetFuture(),
          lastSimTime: nextWakeup,
        },
        time: interactive.time.kind === "paused"
          ? {
              kind: "paused",
              simtime: nextWakeup,
            }
          : interactive.time, // <-- for realtime, time mode remains unchanged (clock already naturally advancing)
        idx: -1,
      }
    });
  }, [setInteractive._setShallow, nextWakeup, forgetFuture]);

  // when user presses <Tab>
  const onSkip = useCallback(() => {
    if (nextWakeup !== Infinity) {
      jumpTimeToNextTimedTransition();
      const setTime = setInteractive.setTime._setShallow as Dispatch<SetStateAction<TimeMode>>;
      setTime(time => timeTravel(time, nextWakeup, now()));
    }
  }, [jumpTimeToNextTimedTransition, nextWakeup, setInteractive.setTime._setShallow, now]);

  // The following effect is what makes timed transitions happen in Statebuddy:
  // timer elapse events are triggered by a change of the simulated time (possibly as a scheduled JS event loop timeout)
  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (interactive.time.kind === "realtime") {
      const wallclkDelay = getWallClkDelay(interactive.time, nextWakeup, Math.round(now()));
      if (wallclkDelay !== Infinity) {
        timeout = setTimeout(jumpTimeToNextTimedTransition, wallclkDelay);
      }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    }
  }, [interactive, nextWakeup, jumpTimeToNextTimedTransition, now]);

  // Back/Next: controlled by arrow keys on the keyboard
  const onBack = useCallback(() => {
    if (fullTrace) {
      const prevItem = fullTrace.trace[fullTrace.idx-1];
      const prevSimtime = prevItem ? prevItem.simtime : 0;
      setInteractive._setShallow(interactive => ({
        trace: interactive.trace,
        time: {
          kind: "paused",
          simtime: prevSimtime,
        },
        idx: fullTrace.idx-1 >= 0 ? fullTrace.idx-1 : 0,
      }))
    }
  }, [fullTrace, setInteractive._setShallow]);
  const onNext = useCallback(() => {
    if (fullTrace) {
      const nextItem = fullTrace.trace[fullTrace.idx+1] || fullTrace.trace[fullTrace.idx];
      setInteractive._setShallow(interactive => ({
        trace: interactive.trace,
        time: {
          kind: "paused",
          simtime: nextItem.simtime,
        },
        idx: fullTrace.idx+1 < fullTrace.trace.length ? fullTrace.idx+1 : fullTrace.idx,
      }));
    }
  }, [fullTrace, setInteractive._setShallow]);

  const selectItem = useCallback((idx: number) => {
    setInteractive._setShallow(interactive => ({
      trace: interactive.trace,
      time: {
        kind: "paused",
        simtime: fullTrace?.trace[idx].simtime || 0,
      },
      idx: idx,
    }))
  }, [fullTrace, setInteractive._setShallow]);

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
  }, [setInteractive._setShallow]);

  const simulatorCallbacks = useMemo(() => ({
    onInit, onClear, onBack, onRaise, onSkip, onReplayTrace, addOutputListener, rmOutputListener,
  }), [onInit, onClear, onBack, onRaise, onSkip, onReplayTrace, addOutputListener, rmOutputListener]);

  const simulator = useMemo(() => ({
      time: interactive.time,
      setTime: setInteractive.setTime._setShallow as Dispatch<SetStateAction<TimeMode>>,
      trace: fullTrace,
      currentTraceItem,
      selectItem,
      nextWakeup,
      runtimeErrors,
      highlightActive,
      highlightTransitions,

      // 'reducers'
      simulatorCallbacks,
  }), [cE, fullTrace, outputListeners, setInteractive._setShallow]);

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
