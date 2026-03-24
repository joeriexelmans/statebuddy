import { PreparedTrace, PropertyCheckStatus } from "@/App/SideBar/prepare_trace_types";

import { loadPyodide, PyodideAPI, version as pyodideVersion } from "pyodide"

import pylibs from "./python-libs.zip";

async function fetchBuffer(url: string) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return buffer;
}

// Spins up an instance of Pyodide with py-mtl loaded and ready to go.
// Slow!!! You don't want to call this in the main thread!!
export async function initPyodide() {
  const pyodide = await loadPyodide({
    checkAPIVersion: false,
    fullStdLib: false,
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
  });
  
  const buf = await fetchBuffer(pylibs);
  pyodide.unpackArchive(buf, "zip", {
    extractDir: '/lib/python3.13/site-packages',
  });

  await pyodide.runPythonAsync(`
    import mtl.parser
  `);

  return pyodide;
}

export const getPropertyChecker = (pyodide: PyodideAPI) => async (property: string, preparedTraces: PreparedTrace): Promise<PropertyCheckStatus> => {
  const codeToRun = `
    result = None
    error = None
    try:
      phi = mtl.parser.parse('${property}')
      traces = {
        ${Object.entries(preparedTraces).map(([traceName, trace]) =>
          `"${traceName}": [${trace.map(([n,b]) =>
            `(${n},${b ? "True" : "False"})`).join(', ')}]`).join(', ')}
      }
      result = phi(traces, time=None, quantitative=False)
    except Exception as e:
      error = str(e)
    (result, error)
  `;
  const pyResult = await pyodide.runPythonAsync(codeToRun);
  const [result, errorMsg] = pyResult.toJs();
  pyResult.destroy();
  if (result) {
    return {kind: "ok", result};
  }
  else {
    return {kind: "nok", errorMsg};
  }
}
