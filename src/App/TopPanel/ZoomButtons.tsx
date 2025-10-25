import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/App/VisualEditor/parameters";
import { Dispatch, memo, SetStateAction, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";

import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';

const shortcutZoomIn = <><kbd>Ctrl</kbd>+<kbd>-</kbd></>;
const shortcutZoomOut = <><kbd>Ctrl</kbd>+<kbd>+</kbd></>;

export const ZoomButtons = memo(function ZoomButtons({showKeys, zoom, setZoom}: {showKeys: boolean, zoom: number, setZoom: Dispatch<SetStateAction<number>>}) {

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;

  function onZoomIn() {
    setZoom(zoom => Math.min(zoom * ZOOM_STEP, ZOOM_MAX));
  }
  function onZoomOut() {
    setZoom(zoom => Math.max(zoom / ZOOM_STEP, ZOOM_MIN));
  }
  
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
          if (e.key === "+") {
          e.preventDefault();
          onZoomIn();
        }
        if (e.key === "-") {
          e.preventDefault();
          onZoomOut();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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
