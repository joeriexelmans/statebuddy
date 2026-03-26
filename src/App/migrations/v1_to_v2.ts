import { myPureDeepAssign } from "@/util/util";
import { AppStateV1 } from "./v1_types";
import { AppStateV2 } from "./v2_types";
import { defaultAppStateV1 } from "./v1_default";
import { defaultAppStateV2 } from "./v2_default";

export function v1_to_v2(state: AppStateV1): AppStateV2 {
  const fullV1 = myPureDeepAssign(defaultAppStateV1, state) as AppStateV1;

  const migrated = {
    stateVersion: 2,
    editorState: fullV1.editorState,
    syntax: {
      declaredInputs: fullV1.declaredInputs,
      declaredOutputs: fullV1.declaredOutputs,
    },
    execution: {
      activeProperty: fullV1.sideBar.propertyEditor.activeProperty,
      properties: fullV1.sideBar.propertyEditor.properties,
      plants: fullV1.sideBar.plantsState,
      savedTraces: fullV1.sideBar.traces.savedTraces,
    },
    mqtt: fullV1.sideBar.mqtt,
    view: {
      visibility: {
        debug: fullV1.topPanel.showDebug,
        errors: fullV1.bottomPanel.errorsExpanded,
        find: fullV1.topPanel.showFindReplace,
        keys: fullV1.topPanel.showKeys,
        plot: fullV1.showPlot,
        table: fullV1.sideBar.propertyEditor.showTable,
      },
      leftPanel: {
        ...fullV1.leftPanel,
        width: fullV1.leftPanelWidth,
      },
      rightPanel: {
        ...fullV1.rightPanel,
        width: fullV1.rightPanelWidth,
      },
      plot: {
        visible: fullV1.plot.visiblePlots,
      },
      topPanel: {
        modelName: fullV1.topPanel.modelName,
        mouseMap: fullV1.topPanel.mouseMap,
        zoom: fullV1.topPanel.zoom * 100,
      },
      trace: {
        autoScroll: fullV1.sideBar.traces.autoScroll,
        microSteps: fullV1.sideBar.traces.showMicroSteps,
        plantSteps: fullV1.sideBar.traces.showPlantTrace,
        transitions: fullV1.sideBar.traces.showTransitions,
        height: fullV1.sideBar.traces.height,
      },
    },
  } as AppStateV2;

  return myPureDeepAssign(defaultAppStateV2, migrated);
}
