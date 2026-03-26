import { memo, ReactNode, useMemo } from "react";
import { MoveUpDown } from "../Components/MoveUpDown";
import { PersistentDetails } from "../Components/PersistentDetails";
import { DeepSetter, makePartialArraySetter, makePartialSetter, WithSetters } from "../makePartialSetter"
import { GlobalProps, PanelItem, panelItemInfo, panelTypes } from "./PanelItem"
import { PanelType } from "../migrations/v1_types";
import CloseIcon from '@mui/icons-material/Close';
import { ExpandablePanelItemState } from "../migrations/v1_types";
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Tooltip } from "../Components/Tooltip";

type PanelProps = {
  items: ExpandablePanelItemState[],
  setItems: DeepSetter<ExpandablePanelItemState[]>,
  globalProps: GlobalProps,
}

export const Panel = memo(function Panel({items, setItems, globalProps}: PanelProps) {
  const onAddPanel = (type: string) => {
    if (panelTypes.includes(type as PanelType)) {
      setItems(items => [...items, {
        type: type as PanelType,
        expanded: true,
      }]);
    }
  };
  const setters = useMemo(() => items.map((_, i) => makePartialArraySetter(setItems, i)), [items]);
  return <div style={{display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between'}}>
    <div style={{display: 'flex', flexGrow: 1, flexDirection: 'column'}}>
      {items.map((item, i) => {
        return <ExpandablePanelItem
          key={item.type} // <-- every panel type can only occur once in each panel
          state={item}
          setState={setters[i]}
          globalProps={globalProps}
          extraButtons={<div>
            {/* @ts-ignore */}
            <MoveUpDown i={i} ls={items} setter={setItems}/>
            <button onClick={() => setItems(items => items.toSpliced(i, 1))}>
              <CloseIcon fontSize="small"/>
            </button>
          </div>}
          />;
      })}
    </div>
    <select value={0} onChange={e => onAddPanel(e.target.value)}>
      <option value={0} disabled>add panel...</option>
      {panelTypes
        .filter(t => !items.some(item => item.type === t))
        .map(t => <option value={t}>{t}</option>)}
    </select>
  </div>;
});

type ExpandablePanelItemProps = WithSetters<{
  state: ExpandablePanelItemState,
}> & {
  extraButtons: ReactNode,
  globalProps: GlobalProps,
}

export function ExpandablePanelItem({state, setState, globalProps, extraButtons}: ExpandablePanelItemProps) {
  const setExpanded = useMemo(() => makePartialSetter(setState, 'expanded'), [setState]);
  const info = panelItemInfo({type: state.type, globalProps, isExpanded: state.expanded});
  return <PersistentDetails
    state={state.expanded}
    setState={setExpanded}
  >
    <summary style={{display: 'flex', justifyContent: 'space-between'}}>
      <div>
        {state.expanded ? "▾" : "▸"}&nbsp;
        {state.type}
        {info && <>&nbsp;<Tooltip tooltip={info} align="left">
            <WarningAmberIcon fontSize="small" style={{color: 'var(--error-color)'}}/>
          </Tooltip></>}
      </div>
      {extraButtons}
    </summary>
    <PanelItem type={state.type} globalProps={globalProps} isExpanded={state.expanded}/>
  </PersistentDetails>
}
