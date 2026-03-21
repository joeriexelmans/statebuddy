// AppState in version 1 of StateBuddy

type ToolMode = "select" | "and" | "or" | "pseudo" | "shallow" | "deep" | "transition" | "text" | "nothing";

type BigStepCause = {
  kind: "init",
  simtime: 0,
} | {
  kind: "input",
  simtime: number,
  eventName: string,
  param?: any,
} | {
  kind: "timer",
  simtime: number,
}

type SavedTraces = [string, BigStepCause[]][];

export type AppStateV0 = {
  modelName: string;
  showKeys: boolean;
  zoom: number;
  showFindReplace: boolean;
  findText: string;
  replaceText: string;
  showPlot: boolean;
  showDebug: boolean;
  sidePanelWidth: number;

  leftMouseMode: ToolMode,   // <-- the tool that is activated by left mouse button
  middleMouseMode: ToolMode, // <-- the tool that is activated by middle mouse button
  insertMode: ToolMode,      // <-- the tool that is activated by right mouse button (should be renamed to 'rightMouseMode' but that would break compatibility with existing StateBuddy models)

  visiblePlots: {[name: string]: boolean},

  showStateTree: boolean,
  showInputEvents: boolean,
  showInternalEvents: boolean,
  showOutputEvents: boolean,
  showPlant: boolean,
  showConnections: boolean,
  showProperties: boolean,
  showExecutionTrace: boolean,
  showTable: boolean,
  plantName: string,

  // maps source to target. e.g.:
  // {
  //  "sc.incTime": ["plant", "incTime"],
  //  "DEBUG_topRightClicked": ["sc", "topRightClicked"],
  // }
  plantConns: {[eventName: string]: [string|null, string]},

  autoConnect: boolean,
  properties: string[],
  activeProperty: number,
  savedTraces: SavedTraces,
  showMicroSteps: boolean,
  autoScroll: boolean,
  showPlantTrace: boolean,
  errorsExpanded: boolean,

  showBBox: boolean,
  showGrid: boolean,
  showCells: boolean,
}
