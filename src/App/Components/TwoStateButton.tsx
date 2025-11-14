import { ButtonHTMLAttributes, PropsWithChildren } from "react";

export function TwoStateButton({active, children, className, ...rest}: PropsWithChildren<{active: boolean} & ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className={(className||"") + (active?" active":"")} {...rest}>{children}</button>
}
