import { useEffect } from "react";

import { DoubleClickButton } from "../Components/DoubleClickButton";
import { MoveUpDown } from "../Components/MoveUpDown";
import { Tooltip } from "../Components/Tooltip";
import { TwoStateButton } from "../Components/TwoStateButton";
import { makeAllSetters, WithSetters } from "../makePartialSetter";
import { PreparedTraces, PropertyCheckResult } from "./prepare_trace";
import { PropertyStatusIndicator } from "./Status";

import styles from "../App.module.css";

// icons
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TableViewIcon from '@mui/icons-material/TableView';
import VisibilityIcon from '@mui/icons-material/Visibility';


export type PropertyEditorState = {
  properties: string[],
  activeProperty: number,
  showTable: boolean,
}

export const defaultPropertyEditorState = {
  properties: [],
  activeProperty: 0,
  showTable: false,
}


type PropertyEditorProps = WithSetters<{
  state: PropertyEditorState;
  propertyResults: PropertyCheckResult[] | undefined;
}> & {
  preparedTraces?: PreparedTraces;
  checkProperty: (property: string, preparedTraces: PreparedTraces) => Promise<PropertyCheckResult>;
  enableTable: boolean;
}

export function PropertyEditor({state: {properties, activeProperty, showTable}, setState, propertyResults, setPropertyResults, preparedTraces, checkProperty, enableTable}: PropertyEditorProps) {

  const {setProperties, setActiveProperty, setShowTable} = makeAllSetters(setState, Object.keys(defaultPropertyEditorState) as (keyof PropertyEditorState)[]);

  // if some properties change, re-evaluate them:
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let clearResultTimeout: NodeJS.Timeout;
    if (preparedTraces) {
      // very often we recompute the same property on a trace that is one item longer, resulting in largely the same trace.
      clearResultTimeout = setTimeout(() => {
        setPropertyResults(undefined);
      }, 500);
      timeout = setTimeout(() => {
        Promise.all(properties.map((property, i) => {
          return checkProperty(property, preparedTraces);
        }))
        .then(results => {
          clearTimeout(clearResultTimeout);
          setPropertyResults(results);
        })
      })
    }
    return () => {
      clearTimeout(timeout);
      clearTimeout(clearResultTimeout);
    };
  }, [preparedTraces, properties]);

  return <>
    {properties.map((property, i) => {
      const result = propertyResults && propertyResults[i];
      let violated = null, propertyError = null;
      if (result) {
        violated = result[0] && result[0].length > 0 && !result[0][0][1];
        propertyError = result[1];
      }
      return <div style={{display: 'flex'}} key={i} className={styles.toolbar}>
        <div>
          <PropertyStatusIndicator status={(violated === null) ? "pending" : (violated ? "nok" : "ok")} />
          <Tooltip tooltip="see in trace (below)" align="left">
            <TwoStateButton active={activeProperty === i} onClick={() => setActiveProperty(i)}>
              <VisibilityIcon fontSize="small"/>
            </TwoStateButton>
          </Tooltip>
        </div>
        <Tooltip
          tooltip=""
          align='left'
          fullWidth={true}
          error={Boolean(propertyError)}
          showWhen='focus'
          >
          <input
            className={propertyError && "error" || ""}
            type="text"
            style={{flexGrow: 1}}
            value={property}
            size={1}
            onChange={e => setProperties(properties => properties.toSpliced(i, 1, e.target.value))} 
            placeholder='write MTL property...'
          />
        </Tooltip>
        <MoveUpDown i={i} ls={properties} setter={setProperties}/>
        <DoubleClickButton
          tooltip="delete this property"
          onDoubleClick={() => setProperties(properties => properties.toSpliced(i, 1))}
          align="right">
          <DeleteOutlineIcon fontSize="small"/>
        </DoubleClickButton>
      </div>;
    })}
    <div className={styles.toolbar}>
      <button onClick={() => setProperties(properties => [...properties, ""])} style={{flexGrow:1}}>
        <AddIcon fontSize="small"/> add property
      </button>
      <Tooltip tooltip="show table view">
        <TwoStateButton active={showTable} onClick={() => setShowTable(s => !s)} disabled={enableTable}>
          <TableViewIcon fontSize='small'/>
          Table
        </TwoStateButton>
      </Tooltip>
      <Tooltip tooltip='see MTL examples' align='right'>
        <button onClick={() => window.open("https://github.com/mvcisback/py-metric-temporal-logic/blob/ceb2567ef90f3bd5d7a8d607806a9d2e7021639e/README.md#string-based-api", "_blank")?.focus()}><HelpOutlineIcon fontSize='small'/> help</button>
      </Tooltip>
    </div>
  </>
}