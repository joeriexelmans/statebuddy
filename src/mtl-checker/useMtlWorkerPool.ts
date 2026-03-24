import { PropertyCheckStatus } from "@/App/SideBar/prepare_trace_types";
import { useWorkerPool, WorkerPoolState } from "@/hooks/useWorkerPool";
import { MtlReq } from "./mtl_types";

export type CheckPropFn = (req: MtlReq) => readonly [Promise<PropertyCheckStatus>, () => void];

export type MtlWorkerPoolState = WorkerPoolState<MtlReq, PropertyCheckStatus>;

export function useMtlWorkerPool(nWorkers: number) {
  return useWorkerPool<MtlReq, PropertyCheckStatus>(nWorkers, "mtl_web_worker.js");
}
