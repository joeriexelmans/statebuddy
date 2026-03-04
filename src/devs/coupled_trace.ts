import { CoupledDEVSState } from "./coupled_devs";
import { DEVSTrace } from "./trace";

// IF we have a trace of a coupled devs, where every component itself is being traced, then we can find out which component made an intTransition if the coupled DEVS made an intTransition.
export function whoMadeTransition(coupledTrace: DEVSTrace<CoupledDEVSState<DEVSTrace<any>>>, kind: "intTransition" | "extTransition") {
  // if an intTransition was made, there MUST be at least 2 items in the trace:
  const curItem = coupledTrace.at(-1)!;
  const prevItem = coupledTrace.at(-2)!;

  const [componentId] = Object.entries(curItem.newState).find(([componentId, componentTrace]) => {
    const lastComponentStep = componentTrace.at(-1)!;
    if (lastComponentStep.kind !== kind) {
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
