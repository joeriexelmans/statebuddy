import { PreparedTrace, PropertyCheckStatus } from "@/App/SideBar/prepare_trace_types";

import { loadPyodide, PyodideAPI, version as pyodideVersion } from "pyodide"

// import pylibs from "./assets/python-libs.zip";

async function fetchBuffer(url: string) {
  const res = await fetch(url);
  if (res.ok) {
    const buffer = await res.arrayBuffer();
    return buffer;
  }
  throw new Error("failed to fetch " + url);
}

// Spins up an instance of Pyodide with py-mtl loaded and ready to go.
// Slow!!! You don't want to call this in the main thread!!
export async function initPyodide() {
  console.log('loading pyodide ...');
  // const path = location.protocol + location.host + location.pathname;
  // console.log({path});
  const pyodide = await loadPyodide({
    // indexURL: location.protocol + location.port + 
    checkAPIVersion: false,
    fullStdLib: false,
    // indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
    indexURL: './assets/pyodide',
    lockFileContents: {
      info: {
        "abi_version": "2025_0",
        "arch": "wasm32",
        "platform": "emscripten_4_0_9",
        "python": "3.13.2",
        "version": "0.28.0.dev0",
      },
      packages: {},
    },
    stdout: console.log,
    stderr: console.log,
  });

  console.log('fetching libs ...');
  const buf = await fetchBuffer("assets/pyodide/mtl-libs.zip");

  console.log('unpacking libs ...');
  pyodide.unpackArchive(buf, "zip", {
    extractDir: '/lib/python3.13/site-packages',
  });

  await pyodide.runPythonAsync(`
    import mtl.parser
  `);

  return pyodide;
}

export const checkProperty = async (pyodide: PyodideAPI, property: string, preparedTraces: PreparedTrace): Promise<PropertyCheckStatus> => {
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
