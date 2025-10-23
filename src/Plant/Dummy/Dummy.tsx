import { RaisedEvent } from "@/statecharts/runtime_types";
import { Plant } from "../Plant";

export const DummyPlant: Plant<{}> = {
  inputEvents: [],
  outputEvents: [],
  initial: () => ({}),
  reduce: (_inputEvent: RaisedEvent, _state: {}) => ({}),
  render: (_state: {}, _raise: (event: RaisedEvent) => void) => <></>,
}
