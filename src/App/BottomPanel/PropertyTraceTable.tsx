import CloseIcon from '@mui/icons-material/Close';
import TextRotateUpIcon from '@mui/icons-material/TextRotateUp';
import TextRotationNoneIcon from '@mui/icons-material/TextRotationNone';
import { useEffect, useState } from "react";
import { Tooltip } from "../Components/Tooltip";
import { TwoStateButton } from "../Components/TwoStateButton";
import { SavedTraces } from "../SideBar/SideBar";
import { Status } from "../SideBar/Status";
import { BigStepCause, TraceItem } from '../hooks/useSimulator';
import { checkProperty, prepareTrace } from '../SideBar/check_property';
import { Plant } from '../Plant/Plant';
import { UniversalPlantState } from '../plants';
import styles from "@/App/App.module.css";

export function PropertyTraceTable({properties, traces, onClose, replayTrace, plant}: {properties: string[], traces: SavedTraces, onClose: () => void, replayTrace: (c: BigStepCause[]) => {trace: [TraceItem, ...TraceItem[]]} | undefined, plant: Plant<any, UniversalPlantState>}) {
  const [rotateText, setRotateText] = useState(false);

  const [results, setResults] = useState<("pending"|"satisfied"|"violated")[][]|null>(null);

  useEffect(() => {
    setResults(() => {
      return properties.map((property, i) => {
        return traces.map(([name, trace], j) => {
          const replayed = replayTrace(trace);
          if (replayed) {
            const {trace} = replayed;
            const prepared = prepareTrace(plant, trace);
            checkProperty(property, prepared).then(([result, errors]) => {
              if (result) {
                const [[_, ok]] = result;
                console.log({result});
                setResults(results => {
                  if (results) {
                    return results?.with(i,
                      results[i].with(j, ok ? "satisfied" : "violated"));
                  }
                  return null;
                });
              }
            });
          }
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
            {traces.map(([name, trace], j) => <th style={{verticalAlign: 'bottom'}}>
              <div style={{writingMode: rotateText ? 'sideways-lr' : undefined}}><span className={styles.description}>{name}</span></div>
            </th>)}
          </tr>
        </thead>
        <tbody>
          {properties.map((property, i) => <tr>
            <td>{property}</td>
            {traces.map(([name, trace], j) => <td>
              <Status status={results===null
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
}