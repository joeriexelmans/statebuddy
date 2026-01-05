
export type Tracer = {
  log: (msg: string) => void;
  indent: () => Tracer;
};

export const dummyTracer = {
  log: (_: string) => {},
  indent: () => dummyTracer,
};
