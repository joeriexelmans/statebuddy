
type RT_ConcreteState = RT_OrState | RT_AndState;

type RT_OrState = {
  kind: "or";
  current: string;
  current_rt: RT_ConcreteState; // keep the runtime configuration only of the current state
}

type RT_AndState = {
  kind: "and";
  children: RT_ConcreteState[]; // keep the runtime configuration of every child
}

type RT_Statechart = {
  root: RT_OrState;
  variables: Map<string, any>;
}
