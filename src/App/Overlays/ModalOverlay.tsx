import { Dispatch, PropsWithChildren, ReactElement, SetStateAction } from "react";

export function ModalOverlay(props: PropsWithChildren<{modal: ReactElement|null, setModal: Dispatch<SetStateAction<ReactElement|null>>}>) {
  return <>
    {props.modal && <div
      className="modalOuter"
      onMouseDown={() => props.setModal(null)}>
      <div className="modalInner">
        <span onMouseDown={e => e.stopPropagation()}>
        {props.modal}
        </span>
      </div>
    </div>}

    {props.children}
  </>;
}
