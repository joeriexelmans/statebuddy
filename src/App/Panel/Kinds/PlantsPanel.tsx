import { Tooltip } from "../../Components/Tooltip"
import { PlantsState } from "../../migrations/v1_types"
import { SimulatorStuff } from "../../hooks/useSimulator"
import { DeepSetter } from "../../makePartialSetter"
import { statebuddyPlants } from "../../plants"
import { Toolbar } from "../../TopPanel/Toolbar"
import { ShowPlants } from "./ShowPlants"

export function PlantsView({plantsState, setPlantsState, simulator}: {plantsState: PlantsState, setPlantsState: DeepSetter<PlantsState>} & {simulator: SimulatorStuff}) {
  const speed = simulator.time.kind === "paused" ? 0 : simulator.time.scale;
  const trace = simulator.trace;
  const coupledState = simulator.currentTraceItem?.newState;

  const onAddPlant = (type: string) => {
    const plantToInstantiate = statebuddyPlants[type];
    if (plantToInstantiate !== undefined) {
      setPlantsState._setShallow(({plants, nextPlantID, ...rest}) => ({
        plants: [
          ...plants,
          {
            id: type + nextPlantID.toString(), // <-- for readability, we include the plant type in the ID
            name: type + nextPlantID.toString(),
            type,
          },
        ],
        nextPlantID: nextPlantID + 1,
        ...rest,
      }));
    }
  };

  return <>
    <Toolbar>
      <Tooltip tooltip={trace!==undefined?"clear the current execution to add plant":""} align='left'>
        <select
          disabled={trace!==undefined}
          value="add plant..."
          onChange={e => onAddPlant(e.target.value)}>
          <option>add plant...</option>
          {Object.keys(statebuddyPlants).map((type) =>
            <option key={type}>{type}</option>
          )}
        </select>
      </Tooltip>
      &nbsp;
    </Toolbar>
    {/* Render plants */}
    {<ShowPlants
      plantsState={plantsState}
      setPlantsState={setPlantsState}
      speed={speed}
      coupledState={coupledState}
      onRaise={simulator.simulatorCallbacks.onRaise}
    />}
  </>
}
