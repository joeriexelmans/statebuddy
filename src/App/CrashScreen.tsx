import { PropsWithChildren } from "react";
import { Centered } from "./Overlays/ModalOverlay";
import deadStatebuddy from "../../artwork/new-logo/dead-statebuddy-optimized.svg";

export function CrashScreen({children}: PropsWithChildren) {
  return <Centered>
    <div style={{textAlign: 'center'}}>
      <img src={deadStatebuddy} style={{width: "min(100%, 200px)", display: 'inline-block'}} />
      {children}
    </div>
  </Centered>;
}
