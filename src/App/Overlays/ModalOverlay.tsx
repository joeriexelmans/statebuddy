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
