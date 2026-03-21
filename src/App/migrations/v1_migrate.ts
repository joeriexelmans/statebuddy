import { myPureDeepAssign } from "@/util/util";
import { AppStateV0 } from "./v0_types";
import { AppStateV1 } from "./v1_types";
import { defaultAppStateV1 } from "./v1_default";
import { DeepPartial } from "@/util/deep_partial";

export function migrateToV1(state: AppStateV0): AppStateV1 {
  const recoveredState: DeepPartial<AppStateV1> = {
    leftPanel: {
      items: [
        {type: "state tree", expanded: state.showStateTree},
        {type: "input events", expanded: state.showInputEvents},
        {type: "internal events", expanded: state.showInternalEvents},
        {type: "output events", expanded: state.showOutputEvents},
        {type: "connect", expanded: state.showConnections},
        {type: "plants", expanded: state.showPlant},
      ],
    },
    rightPanel: {
      items: [
        {type: "properties", expanded: state.showProperties},
        {type: "execution traces", expanded: state.showExecutionTrace},
      ],
    },
    bottomPanel: {
      errorsExpanded: state.errorsExpanded,
    },
    findReplace: {
      findText: state.findText,
      replaceText: state.replaceText,
    },
    plot: {
      visiblePlots: state.visiblePlots,
    },
    sideBar: {
      plantsState: {
        plants: {
          "microwave": [{type: "microwave", id: "0", name: "microwave"}],
          "traffic light": [{type: "traffic light", id: "0", name: "trafficlight"}],
          "digital watch": [{type: "digital watch", id: "0", name: "watch"}],
        }[state.plantName],
        nextPlantID: 1, // <-- there could be at most 1 plant in old statebuddy, so this will surely work
      },
      propertyEditor: {
        properties: state.properties,
        showTable: state.showTable,
        activeProperty: state.activeProperty,
      },
      traces: {
        autoScroll: state.autoScroll,
        showMicroSteps: state.showMicroSteps,
        showPlantTrace: state.showPlantTrace,
        savedTraces: [
          // TODO
        ],
      },
    },
    topPanel: {
      modelName: state.modelName,
      mouseMap: {
        leftMouseMode: "select",
        rightMouseMode: state.insertMode,
        middleMouseMode: state.middleMouseMode,
      },
      showDebug: state.showDebug,
      showFindReplace: state.showFindReplace,
      showKeys: state.showKeys,
      zoom: state.zoom,
    },

    debug: {
      showBBox: state.showBBox,
      showCells: state.showCells,
      showGrid: state.showGrid,
    },

    showPlot: state.showPlot,

    leftPanelWidth: state.sidePanelWidth,
    rightPanelWidth: state.sidePanelWidth,
  }
  return myPureDeepAssign(
    defaultAppStateV1, // <-- fill in missing values
    // try to recover as much as possible from our old state:
    recoveredState);
}
