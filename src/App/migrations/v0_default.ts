import { AppStateV0, ToolModeV0 } from "./v0_types";

export const defaultAppStateV0: AppStateV0 = {
  modelName: "",
  showKeys: true,
  zoom: 1,
  showFindReplace: false,
  findText: "",
  replaceText: "",
  showPlot: false,
  showDebug: false,
  sidePanelWidth: 400,
  leftMouseMode: 'select' as ToolModeV0,
  middleMouseMode: 'nothing' as ToolModeV0,
  insertMode: 'and' as ToolModeV0,
  showStateTree: false,
  showInputEvents: true,
  showInternalEvents: true,
  showOutputEvents: true,
  showPlant: true,
  showConnections: false,
  showProperties: false,
  showExecutionTrace: true,
  showTable: false,

  plantName: 'dummy',
  plantConns: {},
  autoConnect: true,

  properties: [],
  activeProperty: 0,
  savedTraces: [],
  autoScroll: false,
  showMicroSteps: false,
  showPlantTrace: false,

  visiblePlots: {},

  errorsExpanded: false,

  showBBox: false,
  showGrid: false,
  showCells: false,
}
