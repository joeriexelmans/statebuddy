
export type Tracer = {
  log: (msg: string) => void;
  indent: () => Tracer;
};

export const dummyTracer = {
  log: (_: string) => {},
  indent: () => dummyTracer,
};

const makeTracer = (indent: number, msgs: string[]) => ({
  log: (msg: string) => msgs.push(' '.repeat(indent) + msg),
  indent: () => makeTracer(indent + 1, msgs),
});

export const newTracer = () => {
  const msgs = [] as string[];
  const tracer = makeTracer(0, msgs);
  return [msgs, tracer] as const;
};
