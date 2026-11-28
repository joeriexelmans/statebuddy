import { memo, PropsWithChildren, ReactElement } from "react";
import { Tooltip } from "../Components/Tooltip";

export const KeyInfoVisible = memo(function KeyInfoVisible(props: PropsWithChildren<{keyInfo: ReactElement, horizontal?: boolean}>) {
  const display = props.horizontal ? "inline-block" : "block";
  return <div style={{display: 'inline-block'}}>
    <Tooltip tooltip="keyboard shortcut" align="left">
      <div style={{display, fontSize:11, height: 18, textAlign:"center", paddingLeft: 3, paddingRight: 3}}>
        {props.keyInfo}
      </div>
    </Tooltip>
    <div style={{display, textAlign: "center"}}>
      {props.children}
    </div>
  </div>
});

export const KeyInfoHidden = memo(function KeyInfoHidden(props: PropsWithChildren<{}>) {
  return <>{props.children}</>;
});
