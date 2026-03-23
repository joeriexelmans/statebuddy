// import { initPyodide } from "./mtl";


// importScripts("https://cdn.jsdelivr.net/pyodide/v0.18.0/full/pyodide.js");

import { loadPyodide } from "pyodide";

// import tar from "tar-js";

// import pyodideLock from "./wheels/pyodide-lock-min.json"; // <-- only what's strictly necessary

// async function stuff() {
//   const response = await fetch("https://deemz.org/public/python-crap/mtl-fs.tar");
//   const buf = await response.arrayBuffer();
//   const arr = new Uint8Array(buf);

//   console.log(tar);
//   const reader = new Tar(arr);
//   reader.getFiles().forEach(file => {
//     console.log(file);
//   })
// }

// stuff();


async function initPyodide() {
  console.log('loading pyodide...');
  // const packageBaseUrl = location.protocol + location.hostname + ':' + location.port + location.pathname.split('/').slice(0, -1).join('/') + '/';
  // console.log(packageBaseUrl);
  const pyodide = await loadPyodide({
    checkAPIVersion: false,
    fullStdLib: false,
    indexURL: `https://cdn.jsdelivr.net/pyodide/v0.18.0/full/`,
    // @ts-ignore
    // lockFileContents: pyodideLock as Lockfile,
    stdout: (msg: string) => console.log(`Pyodide: ${msg}`),
    // packages: ['metric-temporal-logic'],
    // packageBaseUrl,
    fsInit: async (fs, info) => {
      console.log('hey!!');
    },
  });
  console.log('loaded pyodide');
  await pyodide.runPythonAsync('import mtl.parser');
  console.log("loaded mtl library");
  return pyodide;
}

const promise = initPyodide();


promise.then(() => {
  console.log('ready!');
  postMessage({kind: "ready"});
}).catch(err => {
  console.log('oh no', err);
});

// type Request = {reqId: string, codeToRun: string};

onmessage = ({data}) => {
  promise.then(async pyodide => {
    const result = await pyodide.runPythonAsync(data.codeToRun);
    const result2 = result.toJs();
    result.destroy();
    postMessage({kind: "res", reqId: data.reqId, result: result2});
  });
}
