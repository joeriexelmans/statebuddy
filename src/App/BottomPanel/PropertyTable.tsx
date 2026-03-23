import CloseIcon from '@mui/icons-material/Close';
import TextRotateUpIcon from '@mui/icons-material/TextRotateUp';
import { memo, useMemo, useState } from "react";
import { Tooltip } from "../Components/Tooltip";
import { TwoStateButton } from "../Components/TwoStateButton";
import { PreparedTraces, prepareTraces, PropertyCheckStatus } from '../SideBar/prepare_trace';
import styles from "@/App/App.module.css";
import { restoreTrace } from '@/devs/serialize_trace';
import { DEVSComponent } from '@/devs/devs';
import { CoupledState } from '../hooks/useSimulator';
import { Statechart } from '@/statecharts/abstract_syntax';
import { DEVSTrace } from '@/devs/trace';
import { objectsEqual } from '@/util/util';
import { ExecutionState } from '../migrations/v2_types';
import { PropertyCheckResult } from '../SideBar/PropertyCheckResult';

type PropertyTableProps = {
  abstractSyntax: Statechart,
  execution: ExecutionState,
  cE: DEVSComponent<DEVSTrace<CoupledState>>,
  onClose: () => void,
  checkProperty: (property: string, traces: PreparedTraces) => readonly [Promise<PropertyCheckStatus>, () => void],
}

export const PropertyTable = memo(function PropertyTable({
  abstractSyntax,
  execution,
  cE,
  onClose,
  checkProperty,
}: PropertyTableProps) {
  const {properties, plants, savedTraces} = execution;
  const [rotateText, setRotateText] = useState(false);

  const preparedTraces = useMemo(() => {
    return savedTraces.map(([name, trace], j) => {
      const restored = restoreTrace(trace, cE);
      const prepared = prepareTraces(abstractSyntax, plants, restored);
      return prepared;
    });
  }, [savedTraces]);

  return <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>

    <div style={{overflow: 'auto', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', flexGrow: '1'}}>
      {/* we center the table by putting two growing div's around it */}
      <div style={{flexGrow: '1'}}/>
      <table style={{flexGrow: '0'}}>
        <thead>
          <tr>
            <th style={{verticalAlign: 'bottom'}}>property</th>
            {savedTraces.map(([name, trace], j) => <th key={j} style={{verticalAlign: 'bottom'}}>
              <div style={{writingMode: rotateText ? 'sideways-lr' : undefined}}><span className={styles.description}>{name}</span></div>
            </th>)}
          </tr>
        </thead>
        <tbody>
          {properties.map((property, i) => <tr>
            <td>{property}</td>
            {savedTraces.map(([name, trace], j) => <td key={j}>
              <PropertyCheckResult property={property} trace={preparedTraces[j]} checkProperty={checkProperty} delay={0}/>
            </td>)}
          </tr>)}
        </tbody>
      </table>
      {/* we center the table by putting two growing div's around it */}
      <div style={{flexGrow: '1'}}/>
    </div>

    <div style={{display: 'flex', flexDirection: 'column'}}>
      <Tooltip tooltip="hide" above={true}>
        <button style={{width: 50}} onClick={onClose}>
          <CloseIcon fontSize="small"/>
        </button>
      </Tooltip>
      <Tooltip tooltip="rotate table header text" above={true} align='right'>
        <TwoStateButton style={{width: 50}} active={rotateText} onClick={() => setRotateText(s => !s)}>
          <TextRotateUpIcon fontSize="small"/>
        </TwoStateButton>
      </Tooltip>
    </div>
  </div>;
}, objectsEqual);