import { Box, Stack } from "@mui/material";

export function KeyInfoVisible(props: {keyInfo, children, horizontal?: boolean}) {
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
}

export function KeyInfoHidden(props: {children}) {
  return <>{props.children}</>;
}
