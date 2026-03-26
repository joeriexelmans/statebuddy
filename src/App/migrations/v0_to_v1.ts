import { myPureDeepAssign } from "@/util/util";
import { AppStateV0 } from "./v0_types";
import { AppStateV1 } from "./v1_types";
import { defaultAppStateV1 } from "./v1_default";
import { DeepPartial } from "@/util/deep_partial";
import { defaultAppStateV0 } from "./v0_default";

export function v0_to_v1(state: AppStateV0): AppStateV1 {
  const v0full = myPureDeepAssign(defaultAppStateV0, state) as AppStateV0;

  if (state.savedTraces.length > 0) {
    alert("Notice: you will lose your saved traces because their migration from StateBuddy v1 to v2 hasn't been implemented yet!");
  }

  const recoveredState: DeepPartial<AppStateV1> = {
    editorState: v0full.editorState,
    leftPanel: {
      items: [
        {type: "state tree", expanded: v0full.showStateTree},
        {type: "input events", expanded: v0full.showInputEvents},
        {type: "internal events", expanded: v0full.showInternalEvents},
        {type: "output events", expanded: v0full.showOutputEvents},
        {type: "connect", expanded: v0full.showConnections},
        {type: "plants", expanded: v0full.showPlant},
      ],
    },
    rightPanel: {
      items: [
        {type: "properties", expanded: v0full.showProperties},
        {type: "execution traces", expanded: v0full.showExecutionTrace},
      ],
    },
    bottomPanel: {
      errorsExpanded: v0full.errorsExpanded,
    },
    findReplace: {
      findText: v0full.findText,
      replaceText: v0full.replaceText,
    },
    plot: {
      visiblePlots: v0full.visiblePlots,
    },
    sideBar: {
      plantsState: {
        plants: {
          "microwave": [{type: "microwave", id: "0", name: "microwave"}],
          "traffic light": [{type: "traffic light", id: "0", name: "trafficlight"}],
          "digital watch": [{type: "digital watch", id: "0", name: "watch"}],
        }[v0full.plantName] || [],
        nextPlantID: 1, // <-- there could be at most 1 plant in old statebuddy, so this will surely work
      },
      propertyEditor: {
        properties: v0full.properties,
        showTable: v0full.showTable,
        activeProperty: v0full.activeProperty,
      },
      traces: {
        autoScroll: v0full.autoScroll,
        showMicroSteps: v0full.showMicroSteps,
        showPlantTrace: v0full.showPlantTrace,
        savedTraces: [
          // TODO!
          // the format for encoding traces changed drastically from V0 to V1
          // in V0 it was very ad-hoc (only one plant)
          // in V1 it became just 'coupled DEVS'
        ],
      },
    },
    topPanel: {
      modelName: v0full.modelName,
      mouseMap: {
        leftMouseMode: "select",
        rightMouseMode: v0full.insertMode,
        middleMouseMode: v0full.middleMouseMode,
      },
      showDebug: v0full.showDebug,
      showFindReplace: v0full.showFindReplace,
      showKeys: v0full.showKeys,
      zoom: v0full.zoom,
    },

    debug: {
      showBBox: v0full.showBBox,
      showCells: v0full.showCells,
      showGrid: v0full.showGrid,
    },

    showPlot: v0full.showPlot,

    leftPanelWidth: v0full.sidePanelWidth,
    rightPanelWidth: v0full.sidePanelWidth,
  }
  return myPureDeepAssign(
    defaultAppStateV1, // <-- fill in missing values

    // try to recover as much as possible from our old state:
    recoveredState);
}
