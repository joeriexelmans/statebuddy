import { Dispatch, PropsWithChildren, SetStateAction, useRef } from "react";

// Dirty fix for 2 bugs:
//   - toggle event emitted when changing the 'open'-state
//   - closing details also clsoing all parent <details> nodes
export function MyDetails({open, setOpen, children}: PropsWithChildren<{open: boolean, setOpen: Dispatch<SetStateAction<boolean>>}>) {
  const ref = useRef(null);
  return <details
    ref={ref}
    open={open}
    onToggle={e => {
      e.stopPropagation();
      e.preventDefault();
    }}
    onClick={e => {
      let clickOnSummary = false;
      let element = e.target;
      while (element !== ref.current) {
        // @ts-ignore
        if (element.parentElement === ref.current) {
          // @ts-ignore
          if (element.tagName === "SUMMARY") {
            clickOnSummary = true;
            break;
          }
        }
        // @ts-ignore
        element = element.parentElement;
      }
      
      if (clickOnSummary) {
        console.log('toggle details');
        setOpen(o => !o);
        e.stopPropagation();
        e.preventDefault();
      }
    }}
  >
    {children}
  </details>;
}
