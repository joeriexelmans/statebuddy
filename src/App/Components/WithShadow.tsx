import { PropsWithChildren } from "react";
import styles from "../App.module.css";

export function WithShadow({children}: PropsWithChildren<{}>) {
  return <div
    className={styles.shadowBelow}
    style={{flex: '0 0 content'}}>
    {children}
  </div>
}
