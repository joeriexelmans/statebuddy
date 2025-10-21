import { EventTrigger } from "@/statecharts/label_ast";
import { RaisedEvent } from "@/statecharts/runtime_types";
import { ReactElement } from "react";

export type Plant<StateType> = {
  inputEvents: EventTrigger[];
  outputEvents: EventTrigger[];

  initial: (raise: (event: RaisedEvent) => void) => StateType;
  reducer: (inputEvent: RaisedEvent, state: StateType) => StateType;
  render: (state: StateType) => ReactElement;
}
