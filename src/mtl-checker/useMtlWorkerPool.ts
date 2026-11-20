import { PropertyCheckStatus } from "@/App/SideBar/prepare_trace_types";
import { useWorkerPool, WorkerPoolState } from "@/hooks/useWorkerPool";
import { MtlReq } from "./mtl_types";

export type CheckPropFn = (req: MtlReq) => readonly [Promise<PropertyCheckStatus>, () => void];

export type MtlWorkerPoolState = WorkerPoolState<MtlReq, PropertyCheckStatus>;

import {outputs} from "../../mtl-meta.json";

const workerScriptFileName = "../" + Object.entries(outputs).find(([_outputFilename, {entryPoint}]) => {
  return entryPoint === "src/mtl-checker/mtl_web_worker.ts";
})![0];

export function useMtlWorkerPool(nWorkers: number) {
  // the following only works because
  //   - the dev server has a special route for the web worker
  //   - the build command has our worker as an entry point and then renames it.
  return useWorkerPool<MtlReq, PropertyCheckStatus>(nWorkers, workerScriptFileName);
}
