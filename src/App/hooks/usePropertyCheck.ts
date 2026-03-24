import { useEffect } from "react";
import { PreparedTraces, PropertyCheckStatus } from "../SideBar/prepare_trace";
import { usePromise } from "./usePromise";

function resize<T>(fill: T) {
  return function(arr: T[], newSize: number) {
    return [
      ...arr.slice(0, newSize),
      ...Array.from(Array(Math.max(0, newSize - arr.length))).map(_ => fill),
    ]
  }
}

const statusPending: PropertyCheckStatus = {kind: "pending"};

const customResize = resize<PropertyCheckStatus>(statusPending);

export function usePropertyCheck(
  traces: PreparedTraces | undefined,
  properties: string[],
  checkProperty: (property: string, traces: PreparedTraces) => readonly [Promise<PropertyCheckStatus>, () => void],
) {
  const [results, setResultsPromise] = usePromise<PropertyCheckStatus[]>();

  useEffect(() => {
    // clear previous results
    let timeout: NodeJS.Timeout;
    let clearQueue = () => {};
    const cancel = setResultsPromise(new Promise((resolve) => {
      if (traces) {
        const mapped = properties.map(p => checkProperty(p, traces));
        Promise.all(mapped.map(m => m[0])).then(resolve);
        clearQueue = () => mapped.forEach(m => m[1]());
      }
    }));

    return () => {
      cancel();
      clearQueue();
    };
  }, [traces, properties]);

  if (results.kind === "pending") {
    // checking is pending for all properties
    return properties.map(() => statusPending);
  }
  else if (results.kind === "resolved") {
    return customResize(results.result, properties.length);
  }
  throw new Error("should never happen");
}
