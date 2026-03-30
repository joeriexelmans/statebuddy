import { parseStatechart } from "@/statecharts/parser";
import { makeStatechartPlant, Plant, PlantRenderProps, StatechartPlantSpec } from "../Plant"

import model from "./GantryCrane.json";
import { computeTopology } from "@/statecharts/detect_topology";
import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { RT_Statechart } from "@/statecharts/runtime_types";

const gantryCraneConcreteSyntax = model as ConcreteSyntax;

const [abstractSyntax, parseErrors] = parseStatechart(computeTopology(gantryCraneConcreteSyntax));

if (parseErrors.length > 0) {
  console.error("errors parsing gantry crane statechart:", parseErrors);
}

const gantryCranePlantSpec: StatechartPlantSpec<GantryCraneCleanState> = {
  ast: abstractSyntax,
  cleanupState: (state: RT_Statechart) => {
    function isActive(label: string) {
      return state.mode.has(abstractSyntax.label2State.get(label)!.uid);
    }
    return {
      idle: isActive("IDLE"),
      moving: isActive("MOVING"),
      hoisting: isActive("HOISTING"),
      freezing: isActive("FREEZING"),
      magnet: isActive("Magnet ON"),
    };
  },
  render: GantryCraneView,
  signals: [
    "idle",
    "moving",
    "hoisting",
    "freezing",
    "magnet",
  ],
  uiEvents: [],
}

type GantryCraneCleanState = {
  // plottable signals:
  idle: boolean,
  moving: boolean,
  hoisting: boolean,
  freezing: boolean,
  magnet: boolean,
} 

const initialState: GantryCraneCleanState = {
  idle: true,
  moving: false,
  hoisting: false,
  freezing: false,
  magnet: false,
}

function GantryCraneView({state, speed, raiseUIEvent}: PlantRenderProps<GantryCraneCleanState>) {
  if (state.idle) {
    return <div style={{width: 200}}>
      <div>Crane is IDLE</div>
      <div>Magnet is {state.magnet ? <>ON</> : <>OFF</>}</div>
    </div>;
  }
  else {
    return <div style={{width: 200}}>
      <div>Handling request: {
          state.moving ? "MOVING"
        : state.hoisting ? "HOISTING"
        : "FREEZING"
      }</div>
      <div>Magnet is {state.magnet ? <>ON</> : <>OFF</>}</div>
    </div>
  }
}

export const gantryCranePlant = makeStatechartPlant(gantryCranePlantSpec);