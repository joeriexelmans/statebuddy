import CloseIcon from '@mui/icons-material/Close';
import TextRotateUpIcon from '@mui/icons-material/TextRotateUp';
// import TextRotationNoneIcon from '@mui/icons-material/TextRotationNone';
import { memo, useEffect, useState } from "react";
import { Tooltip } from "../Components/Tooltip";
import { TwoStateButton } from "../Components/TwoStateButton";
import { PropertyStatusIndicator } from "../SideBar/PropertyStatusIndicator";
import { PreparedTraces, prepareTraces, PropertyCheckResult } from '../SideBar/prepare_trace';
import styles from "@/App/App.module.css";
import { restoreTrace } from '@/devs/serialize_trace';
import { DEVSComponent } from '@/devs/devs';
import { CoupledState } from '../hooks/useSimulator';
import { PlantsState } from "../migrations/v2_types";
import { Statechart } from '@/statecharts/abstract_syntax';
import { DEVSTrace } from '@/devs/trace';
import { SavedTraces } from '../migrations/v2_types';
import { objectsEqual } from '@/util/util';
import { StatusType } from '../Components/StatusIndicator';

export const PropertyTraceTable = memo(function PropertyTraceTable({
  abstractSyntax,
  properties,
  traces,
  onClose,
  cE,
  plantsState,
  checkProperty,
}: {abstractSyntax: Statechart, properties: string[], traces: SavedTraces, onClose: () => void, cE: DEVSComponent<DEVSTrace<CoupledState>>, plantsState: PlantsState, checkProperty: (property: string, preparedTraces: PreparedTraces) => Promise<PropertyCheckResult>,
}) {
  const [rotateText, setRotateText] = useState(false);

  const [results, setResults] = useState<StatusType[][]|undefined>(undefined);

  useEffect(() => {
    setResults(() => {
      return properties.map((property, i) => {
        return traces.map(([name, trace], j) => {
          // replay each saved trace (obtaining the full trace), and property check it
          const restored = restoreTrace(trace, cE);
          const prepared = prepareTraces(abstractSyntax, plantsState, restored);
          checkProperty(property, prepared).then(([result, errors]) => {
            if (result) {
              const [[_, ok]] = result;
              setResults(results => {
                if (results) {
                  return results?.with(i,
                    results[i].with(j, ok ? "ok" : "nok"));
                }
                return;
              });
            }
          });
          return "pending";
        })
      })
    });
  }, [traces, properties]);

  return <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>

    <div style={{overflow: 'auto', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', flexGrow: '1'}}>
      {/* we center the table by putting two growing div's around it */}
      <div style={{flexGrow: '1'}}/>
      <table style={{flexGrow: '0'}}>
        <thead>
          <tr>
            <th style={{verticalAlign: 'bottom'}}>property</th>
            {traces.map(([name, trace], j) => <th key={j} style={{verticalAlign: 'bottom'}}>
              <div style={{writingMode: rotateText ? 'sideways-lr' : undefined}}><span className={styles.description}>{name}</span></div>
            </th>)}
          </tr>
        </thead>
        <tbody>
          {properties.map((property, i) => <tr>
            <td>{property}</td>
            {traces.map(([name, trace], j) => <td key={j}>
              <PropertyStatusIndicator status={results===undefined
                ? "pending"
                : (results[i]?.[j] || "pending")}
              />
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
          {/* {rotateText
            ? <TextRotateUpIcon fontSize="small"/>
            : <TextRotationNoneIcon fontSize='small'/>} */}
        </TwoStateButton>
      </Tooltip>
    </div>
  </div>;
}, objectsEqual);