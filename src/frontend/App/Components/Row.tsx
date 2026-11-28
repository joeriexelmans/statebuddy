import { PropsWithChildren, CSSProperties } from "react";

export function Row({ children, style }: PropsWithChildren<{ style?: CSSProperties; }>) {
    return <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'start', ...(style || {}) }}>
        {children}
    </div>;
}
