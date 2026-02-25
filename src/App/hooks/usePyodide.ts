import { getPropertyChecker, initPyodide } from "@/mtl-checker/mtl";
import { PyodideAPI } from "pyodide";
import { useState } from "react";
import { PreparedTraces, PropertyCheckResult } from "../SideBar/prepare_trace";

export function usePyodide() {
  const [state, setState] = useState<{
    status: "notLoaded",
  } | {
    status: "loading" | "loaded",
    promise: Promise<PyodideAPI>,
  }>({status: "notLoaded"});

  const withPyodide = (callback: (pyodide: PyodideAPI) => void) => {
    setState(state => {
      if (state.status === "notLoaded") {
        const promise = initPyodide();
        promise.then(() => setState(_ => ({status: "loaded", promise})));
        promise.then(callback);
        return {
          status: "loading",
          promise,
        }
      }
      else {
        state.promise.then(callback);
        return state; // no change
      }
    })
  }

  const checkProperty = (property: string, preparedTraces: PreparedTraces) => {
    return new Promise<PropertyCheckResult>((resolve, reject) => {
      withPyodide(pyodide => resolve(getPropertyChecker(pyodide)(property, preparedTraces)));
    })
  };

  return {
    status: state.status,
    checkProperty,
  };
}
