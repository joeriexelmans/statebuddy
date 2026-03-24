import { PreparedTrace, PropertyCheckStatus } from "./prepare_trace_types";
import { usePromise } from "../hooks/usePromise"
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
      const [promise, cancelJob] = checkProperty({property, trace});
      setPromise(promise);
      return cancelJob;
    }
  }, delay, [property, trace]);

  if (state.kind === "pending") {
    return {kind: "pending"};
  }
  else if (state.kind === "resolved") {
    return state.result;
  }
  throw new Error("should never reach here");
}

// Given a property and a trace, verifies the property and displays the result as a cute status indicator.
export function PropertyCheckResult({property, trace, checkProperty, delay}: Props) {
  const state = usePropertyCheck(property, trace, delay, checkProperty);

  console.log({state});

  if (state.kind === "pending") {
    return <PropertyStatusIndicator status="pending"/>
  }
  else if (state.kind === "ok") {
    // check succeeded
    const satisfied = state.result[0][1];
    return <PropertyStatusIndicator status={satisfied ? "ok" : "nok"}/>
  }
  else if (state.kind === "nok") {
    // there was an error - probably a syntax error in the property
    return <PropertyStatusIndicator status="pending"/>
  }
}
