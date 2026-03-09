import { ToolSelectState, defaultToolSelectState } from "./Toolbars/ToolSelect";


export type TopPanelState = {
  mouseMap: ToolSelectState;
  zoom: number;
  showKeys: boolean;
  showFindReplace: boolean;
  modelName: string;
  showDebug: boolean;
};

export const defaultTopPanelState = {
  mouseMap: defaultToolSelectState,
  zoom: 1,
  showKeys: true,
  showFindReplace: false,
  modelName: "",
  showDebug: false,
};
