import { PropsWithChildren } from "react";

import styles from "../App.module.css";

export function SizedPanel({width, children}: PropsWithChildren<{width: number}>) {
  return <div 
    className={styles.stackVertical}
    style={{
      flex: '0 0 content',
      overflowY: "auto",
      overflowX: "hidden",
      flexBasis: width,
      maxWidth: '75vw',
      minWidth: 20,
      height: '100%',
    }}>
    {children}
  </div>;
}
