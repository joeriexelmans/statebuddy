import { WebWorkerRequest, WebWorkerResponse } from "@/hooks/worker_pool_types";
import { MtlReq } from "./mtl_types";
import { PropertyCheckStatus } from "@/App/SideBar/prepare_trace_types";

import { checkProperty, initPyodide } from "./mtl_pyodide";

const promise = initPyodide();

promise.then(() => {
  postMessage(null);
}).catch(err => {
  console.error('mtl worker: error booting:', err);
});

onmessage = ({data: {reqId, req: {property, trace}}}: {data: WebWorkerRequest<MtlReq>}) => {  
  promise.then(async pyodide => {
    const res = await checkProperty(pyodide, property, trace);
    const wwRes: WebWorkerResponse<PropertyCheckStatus> = {reqId, res};
    postMessage(wwRes);
  }).catch(err => {
    console.error('mtl worker: error checking property:', err);
  })
};
