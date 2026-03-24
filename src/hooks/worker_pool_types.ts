
export type WebWorkerRequest<I> = { reqId: string; req: I; };
export type WebWorkerResponse<O> = { reqId: string; res: O; } | null;
