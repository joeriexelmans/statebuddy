import { memo } from "react"

import Rotate90DegreesCcwTwoToneIcon from '@mui/icons-material/Rotate90DegreesCcwTwoTone';
import Rotate90DegreesCwTwoToneIcon from '@mui/icons-material/Rotate90DegreesCwTwoTone';
import { Selection } from "../VisualEditor/VisualEditor";

export const RotateButtons = memo(function RotateButtons({selection, onRotate}: {selection: Selection, onRotate: (dir: "ccw"|"cw") => void}) {
  const disabled = selection.length === 0;
  return <>
    <button
      title="rotate selection 90 degrees counter-clockwise"
      onClick={() => onRotate("ccw")}
      disabled={disabled}>
        {<Rotate90DegreesCcwTwoToneIcon fontSize="small"/>}
    </button>
    <button
      title="rotate selection 90 degrees clockwise"
      disabled={disabled}
      onClick={() => onRotate("cw")}>
        {<Rotate90DegreesCwTwoToneIcon fontSize="small"/>}
    </button>
  </>
});
