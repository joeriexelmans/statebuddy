import { DEVSComponent } from "@/devs/devs";
import { SC2DEVSState } from "@/devs/sc2devs";
import { DEVSTrace } from "@/devs/trace";

type CoupledStatechartState = {
  // there's always the design model:
  sc: DEVSComponent<SC2DEVSState>;
} & {
  // and the plants
  [plantName: string]: any;
};

export type TraceViewProps = {
  trace: DEVSTrace<CoupledStatechartState>;
};

export function TraceView({trace}: TraceViewProps) {

}