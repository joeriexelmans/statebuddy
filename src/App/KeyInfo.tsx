import { memo, PropsWithChildren, ReactElement } from "react";

export const KeyInfoVisible = memo(function KeyInfoVisible(props: PropsWithChildren<{keyInfo: ReactElement, horizontal?: boolean}>) {
  return <div style={{display: 'inline-block'}}>
    {/* <Stack direction={props.horizontal ? "row" : "column"}> */}
      <div style={{display: props.horizontal ? 'inline-block' : '', fontSize:11, height: 18, textAlign:"center", paddingLeft: 3, paddingRight: 3}}>
        {props.keyInfo}
      </div>
      <div style={{display: props.horizontal ? 'inline-block' : '', textAlign:"center"}}>
        {props.children}
      </div>
    {/* </Stack> */}
  </div>
});

export const KeyInfoHidden = memo(function KeyInfoHidden(props: PropsWithChildren<{}>) {
  return <>{props.children}</>;
});
