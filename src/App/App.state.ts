// Most of the application state is contained herein.

import { BottomPanelState, defaultBottomPanelState } from "./BottomPanel/BottomPanel.state";
import { DebugState, defaultDebugState } from "./BottomPanel/Debug";
import { defaultPlotState, PlotState } from "./BottomPanel/Plot";
import { PanelState } from "./Panel/Panel";
import { defaultSideBarState, SideBarState } from "./SideBar/SideBar";
import { defaultTopPanelState, TopPanelState } from "./TopPanel/TopPanel.state";
import { defaultFindReplaceState, FindReplaceState } from "./reducers/FindReplaceState";

// The persistent part of the App's state (meaning, the part that is encoded in the URL hash)
// Whatever we put in here, it must be JSON-serializable.
export type AppState = {
  showPlot: boolean,
  sidePanelWidth: number,
  findReplace: FindReplaceState,
  topPanel: TopPanelState,
  bottomPanel: BottomPanelState;
  sideBar: SideBarState;
  plot: PlotState;
  debug: DebugState;

  leftPanel: PanelState,
  rightPanel: PanelState,

  leftPanelWidth: number,
  rightPanelWidth: number,
};

export const defaultAppState: AppState = {
  showPlot: false,
  sidePanelWidth: 400,
  findReplace: defaultFindReplaceState,
  topPanel: defaultTopPanelState,
  sideBar: defaultSideBarState,
  plot: defaultPlotState,
  bottomPanel: defaultBottomPanelState,
  debug: defaultDebugState,
  leftPanel: {
    items: [
      { type: "input events", expanded: true },
      { type: "internal events", expanded: true },
      { type: "output events", expanded: true },
    ],
  },
  rightPanel: {
    items: [
      { type: "execution traces", expanded: true },
    ],
  },

  leftPanelWidth: 200,
  rightPanelWidth: 200,
};
