import { ReactNode } from "react";

export function Overlay({background, children}: {background: ReactNode, children: ReactNode}) {
  return <div style={{position: 'relative'}}>
    <div style={{position: 'absolute'}}>
      {background}
    </div>
    <div style={{position: 'relative', textAlign: 'left'}}>
      {children}
    </div>
  </div>
}
