import { useEffect, useState } from "react";
import { PreparedTraces, PropertyCheckStatus } from "../SideBar/prepare_trace";
import { useDelay } from "./useDelay";
import { useDetectChange2 } from "@/hooks/useDetectChange";

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
  checkProperty: (property: string, traces: PreparedTraces) => Promise<PropertyCheckStatus>,
) {
  const [pending, setPending] = useState<{[p:string]: (PreparedTraces|undefined)[]}>({});
  const [results, setResults] = useState<PropertyCheckStatus[]>([]);

  useEffect(() => {
    // set property status to 'pending' for properties that need re-checking:
    properties.forEach((p, i) => {
      if (pending[p] !== undefined) {
        if (pending[p].includes(traces)) {
          return;
        }
      }
      setResults(rs => customResize(rs, properties.length).with(i, statusPending));
    });
  }, [properties, traces]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPending(pending => {
        if (traces) {
          return Object.fromEntries(properties.map((p, i) => {
            if (pending[p] !== undefined) {
              if (pending[p].includes(traces)) {
                // we already computed this one
                return [p, pending[p]] as const;
              }
            }
            // we haven't computed this property yet
            // setResults(rs => customResize(rs, properties.length).with(i, statusPending));
            checkProperty(p, traces)
              .then(result => {
                setResults(rs => customResize(rs, properties.length).with(i, result));
              });
            // memoize at most 4 items
            const newPending = resize<PreparedTraces|undefined>(undefined)([traces, ...(pending[p]||[])], 4);
            return [p, newPending] as const;
          }));
        }
        else {
          setResults([]);
          return pending;
        }
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [properties, traces]);

  useDetectChange2({pending})

  return customResize(results, properties.length);
}
