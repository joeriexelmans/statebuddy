import { DoubleClickButton } from "../Components/DoubleClickButton";
import { CoupledState } from "../hooks/useSimulator";
import { PlantsState } from "../hooks/useCoupledExecution";
import { WithSetters } from "../makePartialSetter";
import appStyles from "../App.module.css";

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { statebuddyPlants, UniversalPlantState } from "../plants";
import { Plant } from "../Plant/Plant";
import { Tooltip } from "../Components/Tooltip";
import { RaisedEvent } from "@/statecharts/runtime_types";
import { DEVSTrace } from "@/devs/trace";
import { useCallback } from "react";

type ShowPlantsProps = WithSetters<{
  plantsState: PlantsState,
}> & {
  speed: number;
  coupledState?: CoupledState,
  onRaise: (bagOfInputs: RaisedEvent[]) => void,
};

export function ShowPlants({plantsState, setPlantsState, speed, coupledState, onRaise}: ShowPlantsProps) {
  const raiseOneEvent = useCallback((e: RaisedEvent) => onRaise([e]), [onRaise]);
  return plantsState.plants.map(({id, name, type}, i) =>
    <ShowPlant key={id} {...{i, id, name, type,
      onNameChange: (newName: string) => setPlantsState(ps => ({
          ...ps,
          plants: ps.plants.with(i, {id, name: newName, type})})),
      onDelete: () => setPlantsState(ps => ({...ps, plants: ps.plants.toSpliced(i, 1)})),
      plant: statebuddyPlants[type]!.plant,
      speed,
      currentState: coupledState && coupledState[id],
      onRaise: raiseOneEvent,
    }}/>);
}

export function ShowPlant({id, name, type, onDelete, onNameChange, plant, speed, currentState, onRaise}: {
  id: string,
  name: string,
  type: string,
  onDelete: () => void,
  onNameChange: (newName: string) => void,
  plant: Plant<any, UniversalPlantState>,
  speed: number,
  currentState?: DEVSTrace<any>,
  onRaise: (e: RaisedEvent) => void,
}) {
  const state = plant.cleanupState(currentState?.at(-1)?.newState || plant.execution.initial());
  return <div key={id}>
    <div className={appStyles.toolbar}>
      {/* <div>{type}</div> */}
      <Tooltip tooltip="human-readable name for the plant" fullWidth align="left">
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          style={{fontStyle: 'italic', flexGrow: 1}}
        />
      </Tooltip>
      <DoubleClickButton
        tooltip="delete plant"
        align="right"
        onDoubleClick={onDelete}
      >
        <DeleteOutlineIcon fontSize="small"/>
      </DoubleClickButton>
    </div>
    <div style={{display: "flex", justifyContent: 'space-evenly', flexWrap: 'wrap', alignItems: 'center'}}>
      <plant.render
        state={state}
        speed={speed}
        raiseUIEvent={onRaise}
        />
      <table>
        <tbody>
          {Object.entries(state).map(([key, val]) =>
            <tr key={key}><td>{key}</td><td>{JSON.stringify(val)}</td></tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
