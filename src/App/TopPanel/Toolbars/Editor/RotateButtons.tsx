import { memo } from "react"

import Rotate90DegreesCcwTwoToneIcon from '@mui/icons-material/Rotate90DegreesCcwTwoTone';
import Rotate90DegreesCwTwoToneIcon from '@mui/icons-material/Rotate90DegreesCwTwoTone';
import { Tooltip } from "../../../Components/Tooltip";
import { Toolbar } from "../../Toolbar";

export const RotateButtons = memo(function RotateButtons({disabled, onRotate}: {disabled: boolean, onRotate: (dir: "ccw"|"cw") => void}) {
  return <Toolbar>
    <Tooltip tooltip="rotate selection 90 degrees counter-clockwise">
      <button
        onClick={() => onRotate("ccw")}
        disabled={disabled}>
          {<Rotate90DegreesCcwTwoToneIcon fontSize="small"/>}
      </button>
    </Tooltip>
    <Tooltip tooltip="rotate selection 90 degrees clockwise">
      <button
        disabled={disabled}
        onClick={() => onRotate("cw")}>
          {<Rotate90DegreesCwTwoToneIcon fontSize="small"/>}
      </button>
    </Tooltip>
  </Toolbar>
});
