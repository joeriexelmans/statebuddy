import { RaisedEvent } from "@/statecharts/runtime_types";
import { Plant } from "../Plant";

export const DummyPlant: Plant<{}> = {
  inputEvents: [],
  outputEvents: [],
  initial: () => ({}),
  reducer: (_inputEvent: RaisedEvent, _state: {}) => ({}),
  render: (_state: {}) => <></>,
}
