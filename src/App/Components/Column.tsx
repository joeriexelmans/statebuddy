import { PropsWithChildren } from "react";

export function Column({ children }: PropsWithChildren<{}>) {
    return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start' }}>
        {children}
    </div>;
}
