import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';
import BugReportIcon from '@mui/icons-material/BugReport';
import { memo } from "react";
import { useToggle } from "../../../../hooks/useToggle";
import { Tooltip } from "../../../Components/Tooltip";
import { TwoStateButton } from "../../../Components/TwoStateButton";
import { Toolbar } from "../../Toolbar";
import { VisibilityState } from "../../../migrations/v2_types";
import { DeepSetter } from '../../../makePartialSetter';

type ToggleViewProps = {
  KeyInfo: any,
  visibility: VisibilityState,
  setVisibility: DeepSetter<VisibilityState>,
}

export const ToggleView = memo(function ToggleView({KeyInfo, visibility, setVisibility}: ToggleViewProps) {
  return <Toolbar>
    <KeyInfo keyInfo={<><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd></>}>
      <Tooltip tooltip="find & replace ...">
        <TwoStateButton
          active={visibility.find}
          onClick={useToggle(setVisibility.setFind)}
        >
          <FindInPageOutlinedIcon fontSize="small"/>
        </TwoStateButton>
      </Tooltip>
    </KeyInfo>
    <Tooltip tooltip="show debug panel">
      <TwoStateButton
        active={visibility.debug}
        onClick={useToggle(setVisibility.setDebug)}
      >
        <BugReportIcon fontSize="small"/>
      </TwoStateButton>
    </Tooltip>
  </Toolbar>;
});
