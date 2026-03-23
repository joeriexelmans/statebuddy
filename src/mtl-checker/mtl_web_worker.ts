import { getPropertyChecker, initPyodide } from "./mtl";

const promise = initPyodide();

promise.then(() => {
  postMessage(null);
}).catch(err => {
  console.error('error booting pyodide:', err);
});

onmessage = ({data: {reqId, property, preparedTraces}}) => {  
  promise.then(async pyodide => {
    const check = getPropertyChecker(pyodide);
    const result = await check(property, preparedTraces);
    postMessage({reqId, result});
  }).catch(err => {
    console.error('error checking property:', err);
  })
}
