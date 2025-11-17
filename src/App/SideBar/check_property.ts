import { RT_Statechart } from "@/statecharts/runtime_types";
import { Plant } from "../Plant/Plant";
import { TraceItem } from "../hooks/useSimulator";

// const endpoint = "http://localhost:15478/check_property";
const endpoint = "https://deemz.org/apis/mtl-aas/check_property";

export type PropertyTrace = [number, boolean][];

export type PropertyCheckResult = [null|PropertyTrace, null|string];

export type PreparedTraces = { [name: string]: PropertyTrace };

export function prepareTrace(plant: Plant<RT_Statechart, any>, trace: [TraceItem, ...TraceItem[]]): PreparedTraces {
  const cleanPlantStates0 = trace
    .map(v => {
      return {
        simtime: v.simtime,
        state: Object.fromEntries(Object.entries(v.kind === "bigstep" && plant.cleanupState(v.state.plant) || {}).map(([prop, val]) => [prop, Boolean(val)])),
      };
    });

  const cleanPlantStates = cleanPlantStates0
    // we can never have multiple states at the same point in simtime or Argus will panic
    .reduce((trace, entry, i) => {
      const prevEntry = cleanPlantStates0[i-1];
      if (prevEntry !== undefined) {
        if (entry.simtime > prevEntry.simtime) {
          return [...trace, entry]; // ok
        }
        return [...trace.slice(0,-1), entry]; // current entry has same simtime and thus replaces previous entry
      }
      return [entry];
    }, [] as {simtime: number, state: any}[]);

  let traces = {
    'true': [[0, true] as [number, boolean]],
    'false': [[0, false] as [number, boolean]],
  } as {[key: string]: [number, any][]};
  for (const {simtime, state} of cleanPlantStates) {
    for (const [key, value] of Object.entries(state)) {
      // just append
      traces[key] = traces[key] || [];
      const prevSample = traces[key].at(-1);
      // only append sample if value changed:
      if (!prevSample || prevSample[1] !== value) {
        traces[key].push([simtime, value]);
      }
    }
  }

  return traces;
}

export async function checkProperty(property: string, preparedTraces: PreparedTraces): Promise<PropertyCheckResult> {
  // pre-process data...

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        property,
        traces: preparedTraces,
      }),
    });

    const json = await response.json();
    // console.log('backend result:', json);

    if (typeof json === 'string') {
      return [null, json];
    }
    else {
      // @ts-ignore
      return [json.map(([timestamp, satisfied]) => ({timestamp, satisfied})), null];
    }
  }
  catch (e) {
    // @ts-ignore
    return [null, e.message];
  }
}
