import { usePersistentState } from "@/App/persistent_state"
import { DetailsHTMLAttributes, PropsWithChildren } from "react";

type Props = {
  localStorageKey: string,
  initiallyOpen?: boolean,
} & DetailsHTMLAttributes<HTMLDetailsElement>;

// A <details> node that remembers whether it was open or closed by storing that state in localStorage.
export function PersistentDetails({localStorageKey, initiallyOpen, children, ...rest}: PropsWithChildren<Props>) {
  const [open, setOpen] = usePersistentState(localStorageKey, initiallyOpen);
  return <details open={open} onToggle={e => setOpen(e.newState === "open")} {...rest}>
    {children}
  </details>;
}
