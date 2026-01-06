import { PreparedTraces, PropertyCheckResult } from "@/App/SideBar/check_property";

import { loadPyodide, Lockfile, version as pyodideVersion } from "pyodide";

// import pyodideLock from "./wheels/pyodide-lock.json";
import pyodideLock from "./wheels/pyodide-lock-min.json"; // <-- only what's strictly necessary

// change URLs so all the wheels are loaded from our own server
import mtl from "./wheels/metric_temporal_logic-0.4.1-py3-none-any.whl";
import parsimonious from "./wheels/parsimonious-0.9.0-py3-none-any.whl";
import attrs from "./wheels/attrs-22.2.0-py3-none-any.whl";
import discretesignals from "./wheels/discrete_signals-0.8.3-py3-none-any.whl";
import sortedcontainers from "./wheels/sortedcontainers-2.4.0-py2.py3-none-any.whl";
import lenses from "./wheels/lenses-0.5.0-py3-none-any.whl";
import funcy from "./wheels/funcy-1.18-py2.py3-none-any.whl";
import singledispatch from "./wheels/singledispatch-4.1.2-py3-none-any.whl";
import regex from "./wheels/regex-2024.11.6-cp313-cp313-pyodide_2025_0_wasm32.whl";

pyodideLock.packages['metric-temporal-logic'].file_name = mtl;
pyodideLock.packages['parsimonious'].file_name = parsimonious;
pyodideLock.packages['attrs'].file_name = attrs;
pyodideLock.packages['discrete-signals'].file_name = discretesignals;
pyodideLock.packages['sortedcontainers'].file_name = sortedcontainers;
pyodideLock.packages['lenses'].file_name = lenses;
pyodideLock.packages['funcy'].file_name = funcy;
pyodideLock.packages['singledispatch'].file_name = singledispatch;
pyodideLock.packages['regex'].file_name = regex;

// this function was used to discover the closure of dependencies of metric-temporal-logic
// function printdeps(pkgs: any, name: string, indent=0) {
//   console.log('  '.repeat(indent), name);
//   for (const dep of pkgs[name].depends) {
//     printdeps(pkgs, dep, indent+1);
//   }
// }

const pyodidePromise = (async () => {
  const pyodide = await loadPyodide({
    checkAPIVersion: false,
    fullStdLib: false,
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
    // @ts-ignore
    lockFileContents: pyodideLock as Lockfile,
    stdout: (msg) => console.log(`Pyodide: ${msg}`),
    packages: ['metric-temporal-logic'],
  });
  console.log('loaded pyodide');
  await pyodide.runPythonAsync(`
    import mtl.parser
  `);
  console.log("loaded mtl");
  return pyodide;
})();

export async function checkProperty(property: string, preparedTraces: PreparedTraces): Promise<PropertyCheckResult> {
  const pyodide = await pyodidePromise;
  const codeToRun = `
    result = None
    error = None
    try:
      phi = mtl.parser.parse('${property}')
      traces = {
        ${Object.entries(preparedTraces).map(([traceName, trace]) =>
          `"${traceName}": [${trace.map(([n,b]) =>
            `(${n},${b ? "True" : "False"})`).join(',')}]`).join(',')}
      }
      result = phi(traces, time=None, quantitative=False)
    except Exception as e:
      error = str(e)
    (result, error)
  `;
  const result = await pyodide.runPythonAsync(codeToRun);
  return result;
}
