import { Stack } from "@mui/material";

export function KeyInfoVisible(props: {keyInfo, children}) {
  return <Stack style={{display: "inline-block"}}>
    <div style={{fontSize:11, height: 16, textAlign:"center"}}>
      {props.keyInfo}
    </div>
    <div>
      {props.children}
    </div>
  </Stack>
}

export function KeyInfoHidden(props: {children}) {
  return <>{props.children}</>;
}
