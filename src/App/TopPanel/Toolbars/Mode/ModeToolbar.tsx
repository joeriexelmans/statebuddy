import { memo } from "react";
import { Toolbar } from "../../Toolbar";
import { ToolSelect } from "./ToolSelect";
import { ToggleView } from "./ToggleView";
import { ZoomButtons } from "./ZoomButtons";
import { ViewState } from "../../../migrations/v2_types";
import { DeepSetter } from "../../../makePartialSetter";

const toolbarGap = {columnGap: '1em'};

export const ModeToolbar = memo(function ViewToolbar({
  KeyInfo,
  view,
  setView,
}: {
  KeyInfo: any,
  view: ViewState,
  setView: DeepSetter<ViewState>,
}) {
  return <Toolbar style={toolbarGap}>
    {/* insert rountangle / arrow / ... */}
    <Toolbar>
      <ToolSelect
        mouseMap={view.topPanel.mouseMap}
        setMouseMap={setView.setTopPanel.setMouseMap}
        showKeys={view.visibility.keys}
      />
    </Toolbar>

    {/* zoom */}
    <Toolbar>
      <ZoomButtons
        showKeys={view.visibility.keys}
        zoom={view.topPanel.zoom}
        setZoom={setView.setTopPanel.setZoom}/>
    </Toolbar>

    {/* show/hide find/replace, debug */}
    <ToggleView
      KeyInfo={KeyInfo}
      visibility={view.visibility}
      setVisibility={setView.setVisibility}
    />
  </Toolbar>
});
