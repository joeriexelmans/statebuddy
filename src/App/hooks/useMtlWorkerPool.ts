import { useCallback, useEffect, useMemo, useState } from "react";
import { PreparedTraces, PropertyCheckResult } from "../SideBar/prepare_trace";

type WorkerState = "booting" | "ready" | "busy";
type Job = {
  property: string,
  preparedTraces: PreparedTraces,
  resolve: (result: PropertyCheckResult) => void,
};
type Response = {kind: "ready"} | {kind: "res", reqId: string, result: PropertyCheckResult}
type WorkerPoolState = {
  workers: {w: Worker, state: WorkerState}[],
  queue: Job[],
}

let nextReqId = 0;
const requests = new Map<string, (result: PropertyCheckResult) => void>();

function sendJob(
  w: Worker,
  job: Job,
) {
  const reqId = (nextReqId++).toString();
  const codeToRun = `
    result = None
    error = None
    try:
      phi = mtl.parser.parse('${job.property}')
      traces = {
        ${Object.entries(job.preparedTraces).map(([traceName, trace]) =>
          `"${traceName}": [${trace.map(([n,b]) =>
            `(${n},${b ? "True" : "False"})`).join(',')}]`).join(',')}
      }
      result = phi(traces, time=None, quantitative=False)
    except Exception as e:
      error = str(e)
    (result, error)
  `;
  requests.set(reqId, job.resolve);
  w.postMessage({kind: "run", codeToRun, reqId});
}

export function useMtlWorkerPool(nWorkers: number) {
  const [state, setState] = useState<WorkerPoolState>({workers: [], queue: []});

  const nextReadyIdx = useMemo(() => state.workers.findIndex(w => w.state === "ready"), [state.workers]);

  const onRecv = useCallback((w: Worker) => ({data}: {data: Response}) => {
    console.log('received', w, data);
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
    if (data.kind === "res") {
      const r = requests.get(data.reqId);
      if (r) {
        r(data.result);
        requests.delete(data.reqId);
      }
    }
  }, []);

  // react to changing pool size
  useEffect(() => {
    // grow or shrink workers
    setState(state => ({
      workers: [
        // maybe shrink old workers
        ...state.workers.slice(0, nWorkers),
        // maybe create new workers
        ...Array.from(Array(nWorkers - state.workers.length))
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
    }));
  }, [nWorkers]);

  // feed queue items to workers if worker becomes available
  useEffect(() => {
    if (state.queue.length > 0 && nextReadyIdx !== 1) {
      setState(state => {
        const [first, ...rest] = state.queue;
        const {w} = state.workers[nextReadyIdx];
        sendJob(w, first);
        return {
          workers: state.workers.with(nextReadyIdx, {w, state: "busy"}),
          queue: rest,
        }
      })
    }
  }, [state.queue.length, nextReadyIdx]);

  const submitJob = (property: string, preparedTraces: PreparedTraces) => {
    return new Promise(resolve => {
      // everything goes into the queue :)
      setState(({workers, queue}) => ({
        workers,
        queue: [...queue, {property, preparedTraces, resolve}],
      }))
    });
  };

  return [submitJob, state];
}
