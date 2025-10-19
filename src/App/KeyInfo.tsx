import { Stack } from "@mui/material";

export function KeyInfoVisible(props: {keyInfo, children}) {
  return <Stack style={{display: "inline-block"}}>
    <div style={{fontSize:11, height: 18, textAlign:"center", paddingLeft: 3, paddingRight: 3}}>
      {props.keyInfo}
    </div>
    <div style={{textAlign:"center"}}>
      {props.children}
    </div>
  </Stack>
}

export function KeyInfoHidden(props: {children}) {
  return <>{props.children}</>;
}
