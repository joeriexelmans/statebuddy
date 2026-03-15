import { PropsWithChildren } from "react";

import styles from "../App.module.css";

export function SizedPanel({width, children}: PropsWithChildren<{width: number}>) {
  return <>{
    (width > 20) && <div 
    className={styles.stackVertical}
    style={{
      flex: '0 0 content',
      overflowY: "auto",
      overflowX: "hidden",
      flexBasis: width,
      maxWidth: '75vw',
      height: '100%',
    }}>
    {children}
  </div>}</>;
}
