import { CoupledDEVSState } from "./coupled_devs";
import { RaisedEvent } from "./devs_types";
import { DEVSTrace } from "./trace";

// Queries on traces of Coupled DEVS where every component itself is also being traced...

type ComponentTrace = DEVSTrace<any, RaisedEvent>;
type CoupledTrace = DEVSTrace<CoupledDEVSState<ComponentTrace>, RaisedEvent>;


// Assuming a Coupled DEVS made an intTransition, which (one!) component caused it?
export function whoMadeIntTransition(coupledTrace: CoupledTrace): string {
  const curItem = coupledTrace.at(-1)!;
  const prevItem = coupledTrace.at(-2)!; // <-- our trace MUST consist of at least 2 items if a transition was made...

  const [componentId] = Object.entries(curItem.newState).find(([componentId, componentTrace]) => {
    const lastComponentStep = componentTrace.at(-1)!;
    if (lastComponentStep.kind !== "intTransition") {
      // component did not make the right kind of transition
      return false;
    }
    if (lastComponentStep === prevItem.newState[componentId].at(-1)) {
      // component did not step
      return false;
    }
    return true;
  })!;

  return componentId;
}


// Assuming a Coupled DEVS made an extTransition, which (any amount of) components reacted?
export function whoMadeExtTransition(coupledTrace: CoupledTrace): [string, ComponentTrace][] {
  const curItem = coupledTrace.at(-1)!;
  const prevItem = coupledTrace.at(-2)!; // <-- our trace MUST consist of at least 2 items if a transition was made...

  const f = ([componentId, componentTrace]: [string, ComponentTrace]) => {
    const lastComponentStep = componentTrace.at(-1)!;
    if (lastComponentStep.kind !== "extTransition") {
      // component did not make the right kind of transition
      return false;
    }
    if (lastComponentStep === prevItem.newState[componentId].at(-1)) {
      // component did not step
      return false;
    }
    return true;
  }

  const components = Object.entries(curItem.newState).filter(f);
  // const rest = Object.entries(curItem.newState).filter(x => !f(x));

  return components;
}
