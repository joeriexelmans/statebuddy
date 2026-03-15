import { ReactNode, useState } from "react";
import { MoveUpDown } from "../Components/MoveUpDown";
import { PersistentDetails } from "../Components/PersistentDetails";
import { makePartialArraySetter, makePartialSetter, WithSetters } from "../makePartialSetter"
import { GlobalProps, PanelItem, PanelType, panelTypes } from "./PanelItem"
import CloseIcon from '@mui/icons-material/Close';
import { useResizeable } from "@/hooks/useResizeable";
import { ResizeHandle } from "./ResizeHandle";

export type PanelState = {
  items: ExpandablePanelItemState[],
}

type PanelProps = WithSetters<{
  state: PanelState,
}> & {
  globalProps: GlobalProps,
}

export function Panel({state: {items}, setState, globalProps}: PanelProps) {
  const onAddPanel = (type: string) => {
    if (panelTypes.includes(type as PanelType)) {
      setItems(items => [...items, {
        type: type as PanelType,
        expanded: true,
      }]);
    }
  };
  const setItems = makePartialSetter(setState, 'items');
  return <div style={{display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: '100%', justifyContent: 'space-between'}}>
    <div>
      {items.map((item, i) => {
        const setItem = makePartialArraySetter(setItems, i);
        return <ExpandablePanelItem
          key={i}
          state={item}
          setState={setItem}
          globalProps={globalProps}
          extraButtons={<div>
            <MoveUpDown i={i} ls={items} setter={setItems}/>
            <button onClick={() => setItems(items => items.toSpliced(i, 1))}>
              <CloseIcon fontSize="small"/>
            </button>
          </div>}
          />;
      })}
    </div>
    <select value={0} onChange={e => onAddPanel(e.target.value)}>
      <option value={0}>add panel...</option>
      {panelTypes.map(t => <option value={t}>{t}</option>)}
    </select>
  </div>;
}


export type ExpandablePanelItemState = {
  type: PanelType,
  expanded: boolean,
}

type ExpandablePanelItemProps = WithSetters<{
  state: ExpandablePanelItemState,
}> & {
  extraButtons: ReactNode,
  globalProps: GlobalProps,
}

export function ExpandablePanelItem({state, setState, globalProps, extraButtons}: ExpandablePanelItemProps) {
  const setExpanded = makePartialSetter(setState, 'expanded');
  return <PersistentDetails
    state={state.expanded}
    setState={setExpanded}
  >
    <summary style={{display: 'flex', justifyContent: 'space-between'}}>
      {state.expanded ? "▾" : "▸"}&nbsp;
      {state.type}
      {extraButtons}
    </summary>
    <PanelItem type={state.type} globalProps={globalProps}/>
  </PersistentDetails>
}
