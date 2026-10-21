import { parseStatechart } from "@/languages/statecharts/parser/parser";
import { makeStatechartPlant, Plant, PlantRenderProps, StatechartPlantSpec } from "../Plant"

import model from "./GantryCrane.json";
import { computeTopology } from "@/languages/statecharts/parser/detect_topology";
import { ConcreteSyntax } from "@/languages/statecharts/concrete_syntax";
import { RuntimeConfiguration } from "@/languages/statecharts/interpreter/runtime_types";
import { SC2DEVSNonError } from "@/languages/devs/sc2devs";

export const gantryCraneConcreteSyntax = model as ConcreteSyntax;

export const [gantryCraneAbstractSyntax, parseErrors] = parseStatechart(computeTopology(gantryCraneConcreteSyntax));

if (parseErrors.length > 0) {
  console.error("errors parsing gantry crane statechart:", parseErrors);
}

const gantryCranePlantSpec: StatechartPlantSpec<GantryCraneCleanState> = {
  ast: gantryCraneAbstractSyntax,
  cleanupState: (state: SC2DEVSNonError) => {
    function isActive(label: string) {
      return state.rtconfig.mode.has(gantryCraneAbstractSyntax.tag2State.get(label)!.uid);
    }
    return {
      idle: isActive("#idle"),
      moving: isActive("#moving"),
      hoisting: isActive("#hoisting"),
      freezing: isActive("#freezing"),
      magnet: isActive("#magnetOn"),
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