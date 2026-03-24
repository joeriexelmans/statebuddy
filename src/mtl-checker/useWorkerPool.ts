import { PreparedTraces, PropertyCheckStatus } from "@/App/SideBar/prepare_trace";
import { memoizeBounded } from "@/util/util";
import { useCallback, useEffect, useMemo, useState } from "react";

type WorkerState = "booting" | "ready" | "working";

type Job = {
  property: string,
  preparedTraces: PreparedTraces,
  resolve: (result: PropertyCheckStatus) => void,
};

type Response = {reqId: string, result: PropertyCheckStatus} | null;

export type WorkerPoolState = {
  workers: {w: Worker, state: WorkerState}[],
  queue: Job[],
}

let nextReqId = 0;
const requests = new Map<string, (result: PropertyCheckStatus) => void>();

function sendJob(
  w: Worker,
  {property, preparedTraces, resolve}: Job,
) {
  const reqId = (nextReqId++).toString();
  requests.set(reqId, resolve);
  w.postMessage({reqId, property, preparedTraces});
}

export function useMtlWorkerPool(nWorkers: number) {
  const [state, setState] = useState<WorkerPoolState>({workers: [], queue: []});

  const pullJobFromQueue = useCallback(() => {
    setState(state => {
      const nextReadyIdx = state.workers.findIndex(w => w.state === "ready");
      if (state.queue.length > 0 && nextReadyIdx !== -1) {
        const [first, ...rest] = state.queue;
        const {w} = state.workers[nextReadyIdx];
        sendJob(w, first);
        return {
          workers: state.workers.with(nextReadyIdx, {w, state: "working"}),
          queue: rest,
        }
      }
      else return state; // no more jobs or all workers busy => no change
    });
  }, [setState])

  const onRecv = useCallback((w: Worker) => ({data}: {data: Response}) => {
    // whenever we receive a message from a worker, we consider the worker 'ready'
    setState(state => {
      const idx = state.workers.findIndex(wx => wx.w === w);
      if (idx !== -1) {
        return {
          workers: state.workers.with(idx, {w, state: "ready"}),
          queue: state.queue,
        }
      }
      return state; // <-- no change
    });
    //  handle response
    if (data !== null) {
      const r = requests.get(data.reqId);
      if (r) {
        r(data.result);
        requests.delete(data.reqId);
      }
    }
    pullJobFromQueue();
  }, []);

  // react to changing pool size
  useEffect(() => {
    // grow or shrink workers
    setState(state => {
      const keep = state.workers.slice(0, nWorkers);
      const kill = state.workers.slice(nWorkers);
      kill.forEach(w => w.w.terminate());
      return {
        workers: [
          // maybe shrink old workers
          ...keep,
          // maybe create new workers
          ...Array.from(Array(Math.max(0, nWorkers - state.workers.length)))
              .map(() => {
                const w = new Worker("mtl_web_worker.js")
                w.onmessage = onRecv(w);
                return {
                  w,
                  state: "booting" as const,
                };
              }),
          ],
        queue: state.queue,
      };
    });
    pullJobFromQueue();
  }, [nWorkers]);

  const submitJob = useCallback((property: string, preparedTraces: PreparedTraces) => {
    const {promise, resolve} = Promise.withResolvers<PropertyCheckStatus>();
    const job = {property, preparedTraces, resolve};
    setState(({workers, queue}) => ({
      workers,
      queue: [...queue, job],
    }));
    pullJobFromQueue();
    const cancel = () => setState(({workers, queue}) => ({
      workers,
      queue: queue.filter(j => j !== job),
    }));
    return [promise, cancel] as const;
  }, [setState]);

  return [submitJob, state] as const;
}
