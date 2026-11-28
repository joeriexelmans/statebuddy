import { ButtonHTMLAttributes, PropsWithChildren } from "react";

import styles from "../App.module.css";

export function TwoStateButton({active, children, className, ...rest}: PropsWithChildren<{active: boolean} & ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className={(className||"") + ' ' + (active? styles.active:"")} {...rest}>{children}</button>
}
