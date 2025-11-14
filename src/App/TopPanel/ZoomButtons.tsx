import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/App/parameters";
import { Dispatch, memo, SetStateAction, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";

import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { useShortcuts } from "@/hooks/useShortcuts";

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
      <button title="zoom out" onClick={onZoomOut} disabled={zoom <= ZOOM_MIN}><ZoomOutIcon fontSize="small"/></button>
    </KeyInfo>
    <input title="current zoom level" value={zoom.toFixed(3)} style={{width:40}} readOnly/>
    <KeyInfo keyInfo={shortcutZoomIn}>
      <button title="zoom in" onClick={onZoomIn} disabled={zoom >= ZOOM_MAX}><ZoomInIcon fontSize="small"/></button>
    </KeyInfo>
  </>;
});
