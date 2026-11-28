import { HTMLAttributes, PropsWithChildren } from "react";

import styles from "../App.module.css";

export function Toolbar({children, ...rest}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={styles.toolbar} {...rest}>
    {children}
  </div>
}
