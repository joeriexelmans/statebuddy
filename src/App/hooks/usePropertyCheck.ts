import { useEffect } from "react";
import { PreparedTrace, PropertyCheckStatus } from "../SideBar/prepare_trace_types";
import { usePromise } from "./usePromise";
import { arrResizeDefault } from "@/util/util";
import { CheckPropFn } from "@/mtl-checker/useMtlWorkerPool";

const statusPending: PropertyCheckStatus = {kind: "pending"};

export function useCheckProperties(
  trace: PreparedTrace | undefined,
  properties: string[],
  checkProperty: CheckPropFn,
) {
  const [results, setResultsPromise] = usePromise<PropertyCheckStatus[]>();

  useEffect(() => {
    // clear previous results
    let clearQueue = () => {};
    const cancel = setResultsPromise(new Promise((resolve) => {
      if (trace) {
        const mapped = properties.map(property => checkProperty({property, trace}));
        Promise.all(mapped.map(m => m[0])).then(resolve);
        clearQueue = () => mapped.forEach(m => m[1]());
      }
    }));

    return () => {
      cancel();
      clearQueue();
    };
  }, [trace, properties]);

  if (results.kind === "pending") {
    // checking is pending for all properties
    return properties.map(() => statusPending);
  }
  else if (results.kind === "resolved") {
    return arrResizeDefault(results.result, properties.length, statusPending);
  }
  throw new Error("should never happen");
}
