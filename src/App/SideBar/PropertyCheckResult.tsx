import { PreparedTrace, PropertyCheckStatus } from "./prepare_trace_types";
import { usePromise } from "../../hooks/usePromise"
import { PropertyStatusIndicator } from "./PropertyStatusIndicator"
import { useDelayedEffect } from "../../hooks/useDelayedEffect"
import { useEffect } from "react";
import { CheckPropFn } from "@/mtl-checker/useMtlWorkerPool";

type Props = {
  property: string,
  trace?: PreparedTrace,
  checkProperty: CheckPropFn,
  delay: number,
}

export function usePropertyCheck(property: string, trace: PreparedTrace|undefined, delay: number, checkProperty: CheckPropFn): PropertyCheckStatus {
  const [state, setPromise] = usePromise<PropertyCheckStatus>();

  useEffect(() => {
    setPromise(Promise.resolve({kind: "pending"}));
  }, [property, trace]);

  useDelayedEffect(() => {
    if (trace) {
      const [workerPoolPromise, cancelJob] = checkProperty({property, trace});
      setPromise(workerPoolPromise);
      return cancelJob;
    }
  }, delay, [property, trace]);

  if (state.kind === "pending") {
    return {kind: "pending"};
  }
  else if (state.kind === "resolved") {
    return state.result;
  }
  throw new Error("should never reach here - worker pool promises never reject");
}

// Given a property and a trace, verifies the property and displays the result as a cute status indicator.
export function PropertyCheckResult({property, trace, checkProperty, delay}: Props) {
  const state = usePropertyCheck(property, trace, delay, checkProperty);
  return <PropertyCheckResult2 state={state}/>;
}

export function PropertyCheckResult2({state}: {state: PropertyCheckStatus}) {
  if (state.kind === "pending") {
    // check still in progress
    return <PropertyStatusIndicator status="pending"/>
  }
  else if (state.kind === "ok") {
    // check done
    if (state.result.length === 0) {
      // seems necessary?
      return <PropertyStatusIndicator status="pending"/>
    }
    // check succeeded
    const satisfied = state.result[0][1];
    return <PropertyStatusIndicator status={satisfied ? "ok" : "nok"}/>
  }
  else if (state.kind === "nok") {
    // there was an error - probably a syntax error in the property
    return <PropertyStatusIndicator status="err" errorMsg={state.errorMsg}/>
  }
}
