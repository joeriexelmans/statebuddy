import { CSSProperties, PropsWithChildren } from "react";

export function NicelyCentered({children, style}: PropsWithChildren<{style: CSSProperties}>) {
  return <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    ...style,
  }}>
    {children}
  </div>
}