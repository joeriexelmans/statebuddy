import { useContext } from "react";
import { DebugContext } from "./context/DebugContext";
import styles from "./VisualEditor.module.css";

export function DebugUID({uid}: {uid: string}) {
  const debugContext = useContext(DebugContext);
  return <>
    {debugContext.showIDs && <text x={0} y={0} fontSize={10} className={styles.uid}>{uid}</text>}
  </>;
}
