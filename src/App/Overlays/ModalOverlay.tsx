import { Dispatch, PropsWithChildren, ReactElement, SetStateAction } from "react";

import styles from "./ModalOverlay.module.css";

export function ModalOverlay(props: PropsWithChildren<{modal: ReactElement|null, setModal: Dispatch<SetStateAction<ReactElement|null>>}>) {
  return <>
    {props.modal && <div
      className={styles.modalOuter}
      onMouseDown={() => props.setModal(null)}>
      <div className={styles.modalInner}>
        <span onMouseDown={e => e.stopPropagation()}>
        {props.modal}
        </span>
      </div>
    </div>}

    {props.children}
  </>;
}

export function Centered(props: PropsWithChildren<{}>) {
  return <div style={{display: 'flex', height: '100%', flexGrow: 1, alignItems: 'center', justifyContent: 'center'}}>
    <div style={{maxHeight: '100vh', overflow: 'auto'}}>
      {props.children}
    </div>
  </div>;
}
