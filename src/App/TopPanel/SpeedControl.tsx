import { Dispatch, memo, SetStateAction, useCallback, useEffect } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";
import { setRealtime, TimeMode } from "@/statecharts/time";

import SpeedIcon from '@mui/icons-material/Speed';
import { useShortcuts } from "@/hooks/useShortcuts";
import { Tooltip } from "../Components/Tooltip";

import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import AssistWalkerIcon from '@mui/icons-material/AssistWalker';

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
    {/* <label htmlFor="number-timescale"> */}
      {/* <SpeedIcon fontSize="small"/> */}
      <KeyInfo keyInfo={<kbd>S</kbd>}>
        <Tooltip tooltip="real time: slow down" align="left">
          <button onClick={onSlower}>
            {/* ÷2 */}
            <AssistWalkerIcon fontSize="small"/>
            {/* <DirectionsWalkIcon fontSize="small"/> */}
            </button>
        </Tooltip>
      </KeyInfo>
      <Tooltip tooltip={`current time scale
(e.g., a value of '2' means:
twice as fast as wall clock time)`} align="left">
        
        <input id="number-timescale"
          value={timescale.toFixed(3)}
          style={{width:40}}
          readOnly
          // onChange={e => onTimeScaleChange(e.target.value, Math.round(performance.now()))}
        />
      </Tooltip>
      <KeyInfo keyInfo={<kbd>F</kbd>}>
        <Tooltip tooltip="real time: speed up" align="left">
          <button onClick={onFaster}>
            {/* ×2 */}
            <DirectionsRunIcon fontSize="small"/>
          </button>
        </Tooltip>
      </KeyInfo>
    {/* </label>&nbsp; */}
  </>
});
