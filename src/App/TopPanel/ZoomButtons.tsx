import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/App/parameters";
import { Dispatch, memo, SetStateAction, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";

import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../Components/Tooltip";

const shortcutZoomIn = <><kbd>Ctrl</kbd>+<kbd>-</kbd></>;
const shortcutZoomOut = <><kbd>Ctrl</kbd>+<kbd>+</kbd></>;

export const ZoomButtons = memo(function ZoomButtons({showKeys, zoom, setZoom}: {showKeys: boolean, zoom: number, setZoom: Dispatch<SetStateAction<number>>}) {

  useShortcuts([
    {keys: ["Ctrl", "+"], action: onZoomIn}, // plus on numerical keypad
    {keys: ["Ctrl", "Shift", "+"], action: onZoomIn}, // plus on normal keyboard requires Shift key
    {keys: ["Ctrl", "="], action: onZoomIn}, // most browsers also bind this shortcut so it would be confusing if we also did not override it
    {keys: ["Ctrl", "-"], action: onZoomOut},
  ]);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  function onZoomIn() {
    setZoom(zoom => Math.min(zoom * ZOOM_STEP, ZOOM_MAX));
  }
  function onZoomOut() {
    setZoom(zoom => Math.max(zoom / ZOOM_STEP, ZOOM_MIN));
  }
  
  return <>
    <KeyInfo keyInfo={shortcutZoomOut}>
      <Tooltip tooltip="zoom out" align="left">
        <button onClick={onZoomOut} disabled={zoom <= ZOOM_MIN}><ZoomOutIcon fontSize="small"/></button>
      </Tooltip>
    </KeyInfo>
    <Tooltip tooltip="current zoom level" align="left">
      <input value={zoom.toFixed(3)} style={{width:40}} readOnly/>
    </Tooltip>
    <KeyInfo keyInfo={shortcutZoomIn}>
      <Tooltip tooltip="zoom in" align="left">
        <button onClick={onZoomIn} disabled={zoom >= ZOOM_MAX}><ZoomInIcon fontSize="small"/></button>
      </Tooltip>
    </KeyInfo>
  </>;
});
