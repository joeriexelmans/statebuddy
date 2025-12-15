import { ZOOM_STEPS, ZOOM_MAX, ZOOM_MIN } from "@/App/parameters";
import { Dispatch, memo, SetStateAction } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";

import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../Components/Tooltip";
import { EnterText } from "../Components/EnterText";
import { stepDown, stepUp } from "@/util/steps";

const shortcutZoomIn = <><kbd>Ctrl</kbd>+<kbd>+</kbd></>;
const shortcutZoomOut = <><kbd>Ctrl</kbd>+<kbd>-</kbd></>;

export const ZoomButtons = memo(function ZoomButtons({showKeys, zoom, setZoom}: {showKeys: boolean, zoom: number, setZoom: Dispatch<SetStateAction<number>>}) {

  useShortcuts([
    {keys: ["Ctrl", "+"], action: onZoomIn}, // plus on numerical keypad
    {keys: ["Ctrl", "Shift", "+"], action: onZoomIn}, // plus on normal keyboard requires Shift key
    {keys: ["Ctrl", "="], action: onZoomIn}, // most browsers also bind this shortcut so it would be confusing if we also did not override it
    {keys: ["Ctrl", "Shift", "_"], action: onZoomOut},
    {keys: ["Ctrl", "-"], action: onZoomOut},
  ]);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  function onZoomIn() {
    // somewhat confusingly, zoom is actually stored as a fraction, but we display a percentage (and also the zoom steps are defined as percentages).
    // it would've been simpler to store the zoom also as a percentage, but we don't, to remain compatible with our models already 'out there'.
    setZoom(stepUp(ZOOM_STEPS, zoom*100, 1)/100);
  }
  function onZoomOut() {
    // see comment above
    setZoom(stepDown(ZOOM_STEPS, zoom*100, 1)/100);
  }

  function setZoomStr(str: string) {
    if (str.endsWith('%')) {
      str = str.substring(0, str.length-1);
    }
    const n = Number(str.trim());
    if (!Number.isNaN(n)) {
      const newZoom = n/100;
      const bounded = Math.min(Math.max(0.1, newZoom), 9.99); // <-- let's keep it civilized
      return setZoom(bounded);
    }
  }
  
  return <>
    <KeyInfo keyInfo={shortcutZoomOut}>
      <Tooltip tooltip="zoom out">
        <button
          onClick={onZoomOut}
          disabled={zoom*100 <= ZOOM_MIN}
          >
          <ZoomOutIcon fontSize="small"/>
        </button>
      </Tooltip>
    </KeyInfo>
    <Tooltip tooltip="current zoom level">
      <EnterText
        value={Math.round(zoom*100)+'%'}
        style={{width:40}}
        onEnter={str => setZoomStr(str)}
      />
    </Tooltip>
    <KeyInfo keyInfo={shortcutZoomIn}>
      <Tooltip tooltip="zoom in">
        <button
          onClick={onZoomIn}
          disabled={zoom*100 >= ZOOM_MAX}
          >
          <ZoomInIcon fontSize="small"/>
        </button>
      </Tooltip>
    </KeyInfo>
  </>;
});
