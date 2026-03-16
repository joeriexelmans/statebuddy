import { Plant, PlantRenderProps } from "../Plant";

type ScheduledMove = {
  x: number,
  y: number,
};

type SchedulerState = {
  next?: ScheduledMove,
  remainingMoves: ScheduledMove[],
}

const initialState: SchedulerState = {
  remainingMoves: [
    {x: 1200, y: 30},
    {x: 500, y: 20},
    {x: 800, y: 10},
    {x: 100, y: 20},
    {x: 300, y: 10},
    {x: 1500, y: 30},
  ]
}

function SchedulerView({state, speed, raiseUIEvent}: PlantRenderProps<SchedulerState>) {
  return <div>
    <div>There are {state.remainingMoves.length} remaining moves.</div>
    <div>{state.remainingMoves.map((m, i) => <div key={i}>x: {m.x}, y: {m.y}</div>)}</div>
    {state.next && <div>Next mode = x: {state.next.x}, y: {state.next.y}</div>}
  </div>
}

export const schedulerPlant: Plant<SchedulerState, SchedulerState> = {
  execution: {
    initial: () => initialState,
    timeAdvance: (s) => {
      if (s.next) {
        return 200; // ms delay for realism
      }
      else return Infinity;
    },
    intTransition: (s) => {
      if (s.next) {
        const outputEvents = [{name: "makeMove", param: [s.next.x, s.next.y]}];
        const newState = {
          remainingMoves: s.remainingMoves,
        };
        return [outputEvents, newState];
      }
      throw new Error("scheduler never makes intTransition")
    },
    extTransition: (simtime, s, bagOfInputs) => {
      const e = bagOfInputs.find(e => e.name === "ready");
      if (e && s.remainingMoves.length > 0) {
        return {
          next: s.remainingMoves[0],
          remainingMoves: s.remainingMoves.slice(1),
        }
      }
      return s; // ignore
    },
    inputs: ["ready"],
    outputs: ["makeMove"],
  },
  cleanupState: x => x,
  render: SchedulerView,
  signals: [],
  uiEvents: [],
};