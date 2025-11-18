import { memo } from "react"

import Rotate90DegreesCcwTwoToneIcon from '@mui/icons-material/Rotate90DegreesCcwTwoTone';
import Rotate90DegreesCwTwoToneIcon from '@mui/icons-material/Rotate90DegreesCwTwoTone';
import { Selection } from "../VisualEditor/VisualEditor";
import { Tooltip } from "../Components/Tooltip";

export const RotateButtons = memo(function RotateButtons({selection, onRotate}: {selection: Selection, onRotate: (dir: "ccw"|"cw") => void}) {
  const disabled = selection.length === 0;
  return <>
    <Tooltip tooltip="rotate selection 90 degrees counter-clockwise" align="right">
      <button
        onClick={() => onRotate("ccw")}
        disabled={disabled}>
          {<Rotate90DegreesCcwTwoToneIcon fontSize="small"/>}
      </button>
    </Tooltip>
    <Tooltip tooltip="rotate selection 90 degrees clockwise" align="right">
      <button
        disabled={disabled}
        onClick={() => onRotate("cw")}>
          {<Rotate90DegreesCwTwoToneIcon fontSize="small"/>}
      </button>
    </Tooltip>
  </>
});
