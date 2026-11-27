import { PropsWithChildren } from "react";
import styles from "../App.module.css";

export function WithShadow({children, ...rest}: PropsWithChildren<{}> & React.HTMLAttributes<HTMLDivElement>) {
  return <div
    className={styles.shadowBelow}
    style={{flex: '0 0 content'}}
    {...rest}
  >
    {children}
  </div>
}
