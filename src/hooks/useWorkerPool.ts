import { arrResizeDefault } from "@/util/util";
import { useCallback, useEffect, useRef, useState } from "react";
import { WebWorkerRequest, WebWorkerResponse } from "./worker_pool_types";
import { useGenID } from "./useGenID";

type WorkerState = "booting" | "ready" | "working";
type JobQueueEntry<I,O> = {
  req: I,
  onRes: (res: O) => void,
}
export type WorkerPoolState<I,O> = {
  workers: {w: Worker, state: WorkerState}[],
  queue: JobQueueEntry<I,O>[],
}

export function useWorkerPool<I,O>(nWorkers: number, workerUrl: string) {
  const [state, setState] = useState<WorkerPoolState<I,O>>({workers: [], queue: []});

  console.log({poolstate: state});

  const [nextID, releaseID] = useGenID();

  const requests = useRef(new Map<string, (result: any) => void>());

  const sendJob = useCallback((
    w: Worker,
    {req, onRes}: JobQueueEntry<I,O>,
  ) => {
    const reqId = nextID();
    requests.current.set(reqId, onRes);
    const wwReq: WebWorkerRequest<I> = {reqId, req};
    w.postMessage(wwReq);
  }, []);

  const pullJobFromQueue = useCallback(() => {
    setState(state => {
      const nextReadyIdx = state.workers.findIndex(w => w.state === "ready");
      if (state.queue.length > 0 && nextReadyIdx !== -1) {
        const [first, ...rest] = state.queue; // pop from front
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

  const onRecv = useCallback((w: Worker) => ({data}: {data: WebWorkerResponse<O>}) => {
    // whenever we receive a message from a worker, the worker's state becomes 'ready'
    setState(state => {
      // find the worker (it may no longer exist)
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
      const onRes = requests.current.get(data.reqId);
      if (onRes) {
        onRes(data.res);
        requests.current.delete(data.reqId);
        releaseID();
      }
    }
    pullJobFromQueue();
  }, []);

  // react to changing pool size
  useEffect(() => {
    // grow or shrink workers
    setState(({workers, queue}) => ({
      workers: arrResizeDefault(workers, nWorkers,
        // function to create new workers:
        () => {
          const w = new Worker(workerUrl);
          w.onmessage = onRecv(w);
          return {
            w,
            state: "booting" as const,
          };
        },
        // function to destroy old workers:
        ({w}) => w.terminate(),
      ),
      queue,
    }));
    pullJobFromQueue();
  }, [nWorkers]);

  const submitRequest = useCallback((req: I) => {
    const {promise, resolve} = Promise.withResolvers<O>();
    setState(({workers, queue}) => ({
      workers,
      queue: [...queue, {req, onRes: resolve}], // push to back
    }));
    pullJobFromQueue();
    const cancel = () => setState(({workers, queue}) => ({
      workers,
      queue: queue.filter(({req: r}) => r !== req),
    }));
    return [promise, cancel] as const;
  }, [setState]);

  return [submitRequest, state] as const;
}