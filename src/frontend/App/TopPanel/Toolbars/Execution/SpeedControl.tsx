import { setRealtime, TimeMode } from "@/frontend/App/time";
import { Dispatch, memo, SetStateAction, useCallback, useContext } from "react";

import { useShortcuts } from "@/hooks/useShortcuts";
import { stepDown, stepUp } from "@/util/steps";

import AssistWalkerIcon from '@mui/icons-material/AssistWalker';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { EnterText } from "../../../Components/EnterText";
import { Tooltip } from "../../../Components/Tooltip";
import { TIMESCALE_MAX, TIMESCALE_MIN, TIMESCALE_STEPS } from "../../../parameters";
import { KeyInfoVisible, KeyInfoHidden } from "../../KeyInfo";
import { NowContext } from "@/frontend/App/NowContext";

export const SpeedControl = memo(function SpeedControl({
  showKeys,
  time,
  setTime,
}: {
  showKeys: boolean,
  time: TimeMode,
  setTime: Dispatch<SetStateAction<TimeMode>>,
}) {

  const onTimeScaleChange = useCallback((newValue: string, wallclktime: number) => {
    const asFloat = parseFloat(newValue);
    if (Number.isNaN(asFloat)) {
      return;
    }
    const scale = Math.max(Math.min(asFloat, TIMESCALE_MAX), TIMESCALE_MIN);
    setTime(time => {
      if (time.kind === "paused") {
        return {...time, scale};
      }
      else {
        return {...setRealtime(time, wallclktime), scale};
      }
    });
  }, [setTime]);

  const now = useContext(NowContext);

  const onSlower = useCallback(() => {
    onTimeScaleChange(stepDown(TIMESCALE_STEPS, time.scale, 0.001).toString(), Math.round(now()));
  }, [onTimeScaleChange, time.scale, now]);
  const onFaster = useCallback(() => {
    onTimeScaleChange(stepUp(TIMESCALE_STEPS, time.scale, 0.001).toString(), Math.round(now()));
  }, [onTimeScaleChange, time.scale, now]);

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
          <button onClick={onSlower} disabled={time.scale <= TIMESCALE_STEPS[0]}>
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
          value={time.scale.toFixed(3)}
          style={{width:40}}
          onEnter={str => onTimeScaleChange(str, Math.round(now()))}
        />
      </Tooltip>
      <KeyInfo keyInfo={<kbd>F</kbd>}>
        <Tooltip tooltip="real time: speed up">
          <button onClick={onFaster} disabled={time.scale >= TIMESCALE_STEPS.at(-1)!}>
            {/* ×2 */}
            <DirectionsRunIcon fontSize="small"/>
          </button>
        </Tooltip>
      </KeyInfo>
    {/* </label>&nbsp; */}
  </>
});
