
export type PropertyTrace = [number, boolean][]; // list of tuples [timestamp, true or false]
// The successful evaluation of a property is again a trace (of booleans).
export type PropertyCheckStatus = {
  kind: "pending";
} | {
  kind: "ok";
  result: PropertyTrace;
} | {
  kind: "nok";
  errorMsg: string;
};
// Bunch of traces in a format that the property checker can deal with

export type PreparedTrace = { [name: string]: PropertyTrace; };
