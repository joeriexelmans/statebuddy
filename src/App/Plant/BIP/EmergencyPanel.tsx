import { Plant, PlantRenderProps } from "../Plant";

function EmergencyPanelView({raiseUIEvent}: PlantRenderProps<{}>) {
  return <div>
    <button
      style={{backgroundColor: 'red', padding: 5, borderRadius: 20, color: 'white', fontWeight: 'bold'}}
      onClick={() => raiseUIEvent({name: "beginEmergency"})}
    >STOP</button>
    <button
      style={{backgroundColor: 'green', padding: 5, borderRadius: 20, color: 'white', fontWeight: 'bold'}}
      onClick={() => raiseUIEvent({name: "endEmergency"})}
    >RESUME</button>
  </div>;
}

export const emergencyPanelPlant: Plant<[number, any[]], any, {}> = {
  execution: {
    initial: () => ([0, []]),
    timeAdvance: ([simtime, outputs]) => outputs.length > 0 ? simtime : Infinity,
    intTransition: ([simtime, outputs]) => [outputs, [simtime, []]],
    extTransition: (simtime: number, s: any, bagOfInputs: any[]) => [simtime, bagOfInputs],
    inputs: [],
    outputs: [],
  },
  cleanupState: _ => ({}),
  render: EmergencyPanelView,
  uiEvents: [
    {event: "beginEmergency", kind: "event"},
    {event: "endEmergency", kind: "event"},
  ],
  signals: [],
}
