import { PreparedTraces, PropertyCheckResult } from "@/App/SideBar/check_property";
import { loadPyodide, Lockfile, version as pyodideVersion } from "pyodide";

// import pyodideLock from "./pyodide-lock.json";
import pyodideLock from "./pyodide-lock-min.json"; // <-- only what's strictly necessary

// this function was used to discover the closure of dependencies of metric-temporal-logic
// function printdeps(pkgs: any, name: string, indent=0) {
//   console.log('  '.repeat(indent), name);
//   for (const dep of pkgs[name].depends) {
//     printdeps(pkgs, dep, indent+1);
//   }
// }

const pyodidePromise = (async () => {
  const pyodide = await loadPyodide({
    fullStdLib: true,
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
    // @ts-ignore
    lockFileContents: pyodideLock as Lockfile,
    stdout: (msg) => console.log(`Pyodide: ${msg}`),
  });
  console.log('loaded pyodide');
  await pyodide.loadPackage('metric-temporal-logic');
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
      error = e.message
    (result, error)
  `;
  console.log(codeToRun);
  const result = await pyodide.runPythonAsync(codeToRun);
  return result;
}
