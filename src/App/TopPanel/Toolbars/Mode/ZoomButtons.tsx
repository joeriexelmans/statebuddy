import { ZOOM_STEPS, ZOOM_MAX, ZOOM_MIN } from "@/App/parameters";
import { Dispatch, memo, SetStateAction } from "react";
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { useShortcuts } from "@/hooks/useShortcuts";
import { stepDown, stepUp } from "@/util/steps";
import { EnterText } from "../../../Components/EnterText";
import { Tooltip } from "../../../Components/Tooltip";
import { KeyInfoVisible, KeyInfoHidden } from "../../KeyInfo";

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
    setZoom(stepUp(ZOOM_STEPS, zoom, 1));
  }
  function onZoomOut() {
    // see comment above
    setZoom(stepDown(ZOOM_STEPS, zoom, 1));
  }

  function setZoomStr(str: string) {
    if (str.endsWith('%')) {
      str = str.substring(0, str.length-1);
    }
    const n = Number(str.trim());
    if (!Number.isNaN(n)) {
      const newZoom = n;
      const bounded = Math.min(Math.max(10, newZoom), 1000); // <-- let's keep it civilized
      return setZoom(bounded);
    }
  }
  
  return <>
    <KeyInfo keyInfo={shortcutZoomOut}>
      <Tooltip tooltip="zoom out">
        <button
          onClick={onZoomOut}
          disabled={zoom <= ZOOM_MIN}
          >
          <ZoomOutIcon fontSize="small"/>
        </button>
      </Tooltip>
    </KeyInfo>
    <Tooltip tooltip="current zoom level">
      <EnterText
        value={Math.round(zoom)+'%'}
        style={{width:40, textAlign: 'center'}}
        onEnter={str => setZoomStr(str)}
      />
    </Tooltip>
    <KeyInfo keyInfo={shortcutZoomIn}>
      <Tooltip tooltip="zoom in">
        <button
          onClick={onZoomIn}
          disabled={zoom >= ZOOM_MAX}
          >
          <ZoomInIcon fontSize="small"/>
        </button>
      </Tooltip>
    </KeyInfo>
  </>;
});
