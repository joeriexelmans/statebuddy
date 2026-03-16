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

export const emergencyPanelPlant: Plant<{}, {}> = {
  execution: {
    initial: () => ({}),
    timeAdvance: () => Infinity,
    intTransition: () => { throw new Error("emergency panel doesn't make intTransition")},
    extTransition: (simtime, s, bagOfInputs) => s,
    inputs: [],
    outputs: [],
  },
  cleanupState: x => x,
  render: EmergencyPanelView,
  uiEvents: [
    {event: "beginEmergency", kind: "event"},
    {event: "endEmergency", kind: "event"},
  ],
  signals: [],
}