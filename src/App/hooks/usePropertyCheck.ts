import { useEffect, useState } from "react";
import { PreparedTraces, PropertyCheckResult } from "../SideBar/prepare_trace";

export function usePropertyCheck(preparedTraces: PreparedTraces, properties: string[], checkProperty: (property: string, preparedTraces: PreparedTraces) => Promise<PropertyCheckResult>) {
  const [propertyResults, setPropertyResults] = useState<PropertyCheckResult[] | undefined>(undefined);

  // if some properties change, re-evaluate them:
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let clearResultTimeout: NodeJS.Timeout;
    if (preparedTraces) {
      // very often we recompute the same property on a trace that is one item longer, resulting in largely the same trace.
      clearResultTimeout = setTimeout(() => {
        setPropertyResults(undefined);
      }, 500);
      timeout = setTimeout(() => {
        Promise.all(properties.map((property, i) => {
          return checkProperty(property, preparedTraces);
        }))
        .then(results => {
          clearTimeout(clearResultTimeout);
          setPropertyResults(results);
        })
      })
    }
    return () => {
      clearTimeout(timeout);
      clearTimeout(clearResultTimeout);
    };
  }, [preparedTraces, properties]);

  return propertyResults;
}