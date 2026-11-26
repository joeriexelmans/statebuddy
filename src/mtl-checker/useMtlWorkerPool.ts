import { PropertyCheckStatus } from "@/App/SideBar/prepare_trace_types";
import { useWorkerPool, WorkerPoolState } from "@/hooks/useWorkerPool";
import { MtlReq } from "./mtl_types";

export type CheckPropFn = (req: MtlReq) => readonly [Promise<PropertyCheckStatus>, () => void];

export type MtlWorkerPoolState = WorkerPoolState<MtlReq, PropertyCheckStatus>;

const createWorker = () => new Worker(new URL("./mtl_web_worker.ts", import.meta.url), {type: 'module'});

export function useMtlWorkerPool(nWorkers: number) {
  // the following only works because
  //   - the dev server has a special route for the web worker
  //   - the build command has our worker as an entry point and then renames it.
  return useWorkerPool<MtlReq, PropertyCheckStatus>(nWorkers, createWorker);
}
