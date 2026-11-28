import { useWorkerPool, WorkerPoolState } from "@/hooks/worker_pool/useWorkerPool";
import { MtlReq, PropertyCheckStatus } from "../../mtl-checker/mtl_types";

export type CheckPropFn = (req: MtlReq) => readonly [Promise<PropertyCheckStatus>, () => void];

export type MtlWorkerPoolState = WorkerPoolState<MtlReq, PropertyCheckStatus>;

const createWorker = () => new Worker(new URL("@/mtl-checker/mtl_web_worker_script.ts", import.meta.url), {type: 'module'});

export function useMtlWorkerPool(nWorkers: number) {
  // the following only works because
  //   - the dev server has a special route for the web worker
  //   - the build command has our worker as an entry point and then renames it.
  return useWorkerPool<MtlReq, PropertyCheckStatus>(nWorkers, createWorker);
}
