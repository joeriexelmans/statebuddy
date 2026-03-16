import { Plant, PlantRenderProps } from "../Plant"

type GantryCraneRequest = "move" | "hoist" | "freeze";

type GantryCraneMode = "idle" | GantryCraneRequest;

const validRequests = ["move", "hoist", "freeze"] as GantryCraneRequest[];

// e.g., validResponse("move") === "doneMove"
const validResponse = (m: GantryCraneRequest) => {
  return "done"+m[0].toUpperCase()+m.slice(1);
}

type GantryCraneState = {
  mode: GantryCraneMode,
  nextWakeup: number,
  x: number,
  y: number,
  destX: number,
  destY: number,
  msg: string, // <-- error to display in case of bad request
}

type GantryCraneCleanState = {
  // plottable signals:
  idle: boolean,
  moving: boolean,
  hoisting: boolean,
  freezing: boolean,
} & GantryCraneState;

const initialState: GantryCraneState = {
  mode: "idle",
  nextWakeup: Infinity,
  x: 0,
  y: 100,
  destX: 0,
  destY: 100,
  msg: "",
}

function GantryCraneView({state, speed, raiseUIEvent}: PlantRenderProps<GantryCraneCleanState>) {
  if (state.idle) {
    return <div>Crane is IDLE</div>
  }
  else {
    return <div>
      <div>Handling request: {state.mode}</div>
      <div>Target: {state.destX}, {state.destY}</div>
      <div>Will be done at time: {state.nextWakeup} (ms, simtime)</div>
    </div>
  }
}

export const gantryCranePlant: Plant<GantryCraneState, GantryCraneCleanState> = {
  execution: {
    initial: () => {
      return initialState;
    },
    timeAdvance: (s) => {
      return s.nextWakeup;
    },
    intTransition: (s) => {
      if (s.mode === "idle") {
        throw new Error("crane cannot make intTransition! timeAdvance infinity");
      }
      else {
        const outputEvents = [{name: validResponse(s.mode)}];
        const newState = {
          ...s,
          mode: "idle" as GantryCraneMode,
          nextWakeup: Infinity,
          // we have arrived at destination:
          x: s.destX,
          y: s.destY,
          msg: "",
        };
        return [outputEvents, newState] as const;
      }
    },
    extTransition: (simtime, s, bagOfInputs) => {
      if (s.mode === "idle") {
        // we'll handle at most one event
        // find first valid request among bag of inputs:
        const eventToHandle = bagOfInputs.find(e => validRequests.includes(e.name as GantryCraneRequest));
        if (eventToHandle && typeof eventToHandle.param === 'number') {
          const reqMode = eventToHandle.name as GantryCraneMode;
          let dest;
          if (reqMode === "move") {
            dest = { x: eventToHandle.param, y: s.destY }; 
          }
          else if (reqMode == "hoist") {
            dest = { x: s.destX, y: eventToHandle.param }; 
          }
          else {
            dest = { x: s.destX, y: s.destY }; // <-- no change
          }
          return {
            ...s,
            mode: reqMode,
            nextWakeup: simtime + 3587, // <-- every request takes this many millisecs :p
            ...dest,
            msg: "",
          };
        }
      }
      return {
        ...s,
        msg: "invalid request",
      };
    },
    inputs: validRequests,
    outputs: validRequests.map(validResponse),
  },
  cleanupState: x => ({
    ...x,
    idle: x.mode === "idle",
    moving: x.mode === "move",
    hoisting: x.mode === "hoist",
    freezing: x.mode === "freeze",
  }),
  render: GantryCraneView,
  uiEvents: [],
  signals: [
    "idle",
    "moving",
    "hoisting",
    "freezing",
  ],
}