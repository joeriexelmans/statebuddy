import { Dispatch, memo, SetStateAction, useCallback, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { setRealtime, TimeMode } from "@/statecharts/time";

import SpeedIcon from '@mui/icons-material/Speed';
import { useShortcuts } from "@/hooks/useShortcuts";

export const SpeedControl = memo(function SpeedControl({showKeys, timescale, setTimescale, setTime}: {showKeys: boolean, timescale: number, setTimescale: Dispatch<SetStateAction<number>>, setTime: Dispatch<SetStateAction<TimeMode>>}) {

  const onTimeScaleChange = useCallback((newValue: string, wallclktime: number) => {
    const asFloat = parseFloat(newValue);
    if (Number.isNaN(asFloat)) {
      return;
    }
    const maxed = Math.min(asFloat, 64);
    const mined = Math.max(maxed, 1/64);
    setTimescale(mined);
    setTime(time => {
      if (time.kind === "paused") {
        return time;
      }
      else {
        return setRealtime(time, mined, wallclktime);
      }
    });
  }, [setTime, setTimescale]);

  const onSlower = useCallback(() => {
    onTimeScaleChange((timescale/2).toString(), Math.round(performance.now()));
  }, [onTimeScaleChange, timescale]);
  const onFaster = useCallback(() => {
    onTimeScaleChange((timescale*2).toString(), Math.round(performance.now()));
  }, [onTimeScaleChange, timescale]);

  useShortcuts([
    {keys: ["s"], action: onSlower},
    {keys: ["f"], action: onFaster},
  ]);

  const KeyInfo = showKeys ? KeyInfoVisible : KeyInfoHidden;
  return <>
    <label htmlFor="number-timescale"><SpeedIcon fontSize="small"/></label>&nbsp;
    <KeyInfo keyInfo={<kbd>S</kbd>}>
      <button title="slower" onClick={onSlower}>÷2</button>
    </KeyInfo>
    <input title="controls how fast the simulation should run in real time mode - larger than 1 means: faster than wall-clock time" id="number-timescale" value={timescale.toFixed(3)} style={{width:40}} readOnly onChange={e => onTimeScaleChange(e.target.value, Math.round(performance.now()))}/>
    <KeyInfo keyInfo={<kbd>F</kbd>}>
      <button title="faster" onClick={onFaster}>×2</button>
    </KeyInfo>
  </>
});
