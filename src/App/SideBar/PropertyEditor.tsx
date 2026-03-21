
import { AppState } from "../App.state";
import { DoubleClickButton } from "../Components/DoubleClickButton";
import { MoveUpDown } from "../Components/MoveUpDown";
import { Tooltip } from "../Components/Tooltip";
import { TwoStateButton } from "../Components/TwoStateButton";
import { WithSetters } from "../makePartialSetter";
import { PropertyCheckResult } from "./prepare_trace";
import { PropertyStatusIndicator } from "./PropertyStatusIndicator";

import styles from "../App.module.css";

// icons
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TableViewIcon from '@mui/icons-material/TableView';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Dispatch, memo, SetStateAction } from "react";
import { StatusType } from "../Components/StatusIndicator";

type PropertyEditorProps = WithSetters<{
  properties: string[],
  activeProperty: number,
  showTable: boolean,
}> & {
  propertyResults: PropertyCheckResult[] | undefined;
}

export function PropertyEditor({
  properties,
  setProperties,
  activeProperty,
  setActiveProperty,
  propertyResults,
  showTable,
  setShowTable,
}: PropertyEditorProps) {
  const disableTable = properties.length === 0;

  return <>
    {properties.map((property, i) => {
      const result = propertyResults && propertyResults[i];
      let violated, propertyError;
      if (result) {
        violated = result[0] && result[0].length > 0 && !result[0][0][1];
        propertyError = result[1];
      }
      const status = (violated === undefined) ? "pending" : (violated ? "nok" : "ok");
      return <div style={{display: 'flex'}} key={`${i}-${property}`} className={styles.toolbar}>
        <SingleProperty
          i={i}
          status={status}
          property={property}
          isActive={activeProperty === i}
          setActiveProperty={setActiveProperty}
          setProperties={setProperties}
        />
        {/* @ts-ignore */}
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
        <TwoStateButton active={showTable} onClick={() => setShowTable(s => !s)} disabled={disableTable}>
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

const SingleProperty = memo(function SingleProperty({i, status, property, isActive, setActiveProperty, error, setProperties}: {
  i: number,
  status: StatusType,
  property: string,
  isActive: boolean,
  setActiveProperty: (i: number) => void,
  error?: string,
  setProperties: Dispatch<SetStateAction<string[]>>,
}) {
  return <>
    <div>
      P{i}
      <PropertyStatusIndicator status={status} />
      <Tooltip tooltip="see in trace (below)" align="left">
        <TwoStateButton active={isActive} onClick={() => setActiveProperty(isActive ? -1 : i)}>
          <VisibilityIcon fontSize="small"/>
        </TwoStateButton>
      </Tooltip>
    </div>
    <Tooltip
      tooltip=""
      align='left'
      fullWidth={true}
      error={Boolean(error)}
      showWhen='focus'
      >
      <input
        className={error && "error" || ""}
        type="text"
        style={{flexGrow: 1}}
        value={property}
        size={1}
        onChange={e => setProperties(properties => properties.toSpliced(i, 1, e.target.value))} 
        placeholder='write MTL property...'
      />
    </Tooltip>
  </>;
});
