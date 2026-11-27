import { Dispatch, PropsWithChildren, SetStateAction, useRef } from "react";

import styles from "../App.module.css";
import { Scrollable, ScrollableState } from "../Components/Scrollable";

export function SizedPanel({scroll, setScroll, width, children, ...rest}: PropsWithChildren<{scroll: ScrollableState, setScroll: Dispatch<SetStateAction<ScrollableState>>, width: number}> & React.HTMLAttributes<HTMLDivElement>) {
  const scrollRef = useRef(null);
  return <>{
    (width > 20) && <Scrollable 
      ref={scrollRef}
      state={scroll}
      setState={setScroll}
      className={styles.stackVertical}
      style={{
        flex: '0 0 content',
        overflowY: "auto",
        overflowX: "clip",
        flexBasis: width,
        maxWidth: '75vw',
        height: '100%',
      }}
      {...rest}
      >
    {children}
  </Scrollable>}</>;
}
