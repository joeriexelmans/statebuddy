import { setRealtime, TimeMode } from "@/statecharts/time";
import { Dispatch, memo, SetStateAction, useCallback } from "react";
import { KeyInfoHidden, KeyInfoVisible } from "./KeyInfo";

import { useShortcuts } from "@/hooks/useShortcuts";
import { stepDown, stepUp } from "@/util/steps";
import { Tooltip } from "../Components/Tooltip";

import AssistWalkerIcon from '@mui/icons-material/AssistWalker';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { EnterText } from "../Components/EnterText";
import { TIMESCALE_MAX, TIMESCALE_MIN, TIMESCALE_STEPS } from "../parameters";

export const SpeedControl = memo(function SpeedControl({showKeys, timescale, setTimescale, setTime}: {showKeys: boolean, timescale: number, setTimescale: Dispatch<SetStateAction<number>>, setTime: Dispatch<SetStateAction<TimeMode>>}) {

  const onTimeScaleChange = useCallback((newValue: string, wallclktime: number) => {
    const asFloat = parseFloat(newValue);
    if (Number.isNaN(asFloat)) {
      return;
    }
    const maxed = Math.min(asFloat, TIMESCALE_MAX);
    const mined = Math.max(maxed, TIMESCALE_MIN);
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
    onTimeScaleChange(stepDown(TIMESCALE_STEPS, timescale, 0.001).toString(), Math.round(performance.now()));
  }, [onTimeScaleChange, timescale]);
  const onFaster = useCallback(() => {
    onTimeScaleChange(stepUp(TIMESCALE_STEPS, timescale, 0.001).toString(), Math.round(performance.now()));
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
        <Tooltip tooltip="real time: slow down">
          <button onClick={onSlower} disabled={timescale <= TIMESCALE_STEPS[0]}>
            {/* ÷2 */}
            <AssistWalkerIcon fontSize="small"/>
            {/* <DirectionsWalkIcon fontSize="small"/> */}
            </button>
        </Tooltip>
      </KeyInfo>
      <Tooltip tooltip={`current time scale
(e.g., a value of '2' means:
twice as fast as wall clock time)`}>
        <EnterText id="number-timescale"
          value={timescale.toFixed(3)}
          style={{width:40}}
          onEnter={str => onTimeScaleChange(str, Math.round(performance.now()))}
        />
      </Tooltip>
      <KeyInfo keyInfo={<kbd>F</kbd>}>
        <Tooltip tooltip="real time: speed up">
          <button onClick={onFaster} disabled={timescale >= TIMESCALE_STEPS.at(-1)!}>
            {/* ×2 */}
            <DirectionsRunIcon fontSize="small"/>
          </button>
        </Tooltip>
      </KeyInfo>
    {/* </label>&nbsp; */}
  </>
});
