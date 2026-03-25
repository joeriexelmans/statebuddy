import appStyles from "../../App.module.css";

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { RaisedEvent } from "@/statecharts/runtime_types";
import { DEVSTrace } from "@/devs/trace";
import { memo, useCallback, useMemo } from "react";
import { DoubleClickButton } from "../../Components/DoubleClickButton";
import { Tooltip } from "../../Components/Tooltip";
import { CoupledState } from "../../hooks/useSimulator";
import { DeepSetter } from "../../makePartialSetter";
import { PlantsState } from "../../migrations/v1_types";
import { Plant } from "../../Plant/Plant";
import { statebuddyPlants, UniversalPlantState } from "../../plants";

type ShowPlantsProps = {
  plantsState: PlantsState,
  setPlantsState: DeepSetter<PlantsState>,
  speed: number;
  coupledState?: CoupledState,
  onRaise: (bagOfInputs: RaisedEvent[]) => void,
};

export function ShowPlants({plantsState, setPlantsState: {setPlants}, speed, coupledState, onRaise}: ShowPlantsProps) {
  const onNameChange = useMemo(() => plantsState.plants.map((_, i) => {
    return (newName: string) =>
      setPlants(ps => ps.with(i, {id: ps[i].id, name: newName, type: ps[i].type}));
  }), [plantsState]);
  const onDelete = useMemo(() => plantsState.plants.map((_, i) => {
    return () => setPlants(ps => ps.toSpliced(i, 1));
  }), [plantsState]);
  const raiseOneEvent = useCallback((e: RaisedEvent) => onRaise([e]), [onRaise]);

  return plantsState.plants.map(({id, name, type}, i) =>
    <ShowPlant key={id}
      id={id}
      name={name}
      type={type}
      onDelete={onDelete[i]}
      onNameChange={onNameChange[i]}
      onRaise={raiseOneEvent}
      plant={statebuddyPlants[type]!.plant}
      speed={speed}
      currentState={coupledState?.[id]}
    />)
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
    <PlantForm name={name} type={type} onNameChange={onNameChange} onDelete={onDelete} />
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

const PlantForm = memo(function PlantForm({name, type, onNameChange, onDelete}: {
  name: string,
  type: string,
  onDelete: () => void,
  onNameChange: (newName: string) => void,
}) {
  return <div className={appStyles.toolbar}>
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
  </div>;
});
