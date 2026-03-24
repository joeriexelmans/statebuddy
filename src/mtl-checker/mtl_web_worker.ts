import { WebWorkerRequest, WebWorkerResponse } from "@/hooks/worker_pool_types";
import { MtlReq } from "./mtl_types";
import { PropertyCheckStatus } from "@/App/SideBar/prepare_trace_types";

import { checkProperty, initPyodide } from "./mtl_pyodide";

console.log('booting mtl worker...');

const promise = initPyodide();

promise.then(() => {
  console.log('mtl worker ready');
  postMessage(null);
}).catch(err => {
  console.error('error booting pyodide:', err);
});

onmessage = ({data: {reqId, req: {property, trace}}}: {data: WebWorkerRequest<MtlReq>}) => {  
  promise.then(async pyodide => {
    const res = await checkProperty(pyodide, property, trace);
    const wwRes: WebWorkerResponse<PropertyCheckStatus> = {reqId, res};
    postMessage(wwRes);
  }).catch(err => {
    console.error('error checking property:', err);
  })
};
