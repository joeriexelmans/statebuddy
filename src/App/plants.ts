import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { digitalWatchPlant, dwatchAbstractSyntax, dwatchConcreteSyntax } from "./Plant/DigitalWatch/DigitalWatch";
import { microwaveAbstractSyntax, microwaveConcreteSyntax, microwavePlant } from "./Plant/Microwave/Microwave";
import { Plant } from "./Plant/Plant";
import { trafficLightAbstractSyntax, trafficLightConcreteSyntax, trafficLightPlant } from "./Plant/TrafficLight/TrafficLight";
import { SC2DEVSState } from "@/devs/sc2devs";
import { Statechart } from "@/statecharts/abstract_syntax";

export type UniversalPlantState = {[property: string]: boolean|number};

// A plant that is implemented as a Statechart
type StatechartPlant = Plant<SC2DEVSState, UniversalPlantState>;

export type ScPlantSpec = {
  plant: StatechartPlant,
  cs: ConcreteSyntax,
  as: Statechart,
}

export const statebuddyPlants: {[type: string]: ScPlantSpec} = {
  "microwave": {
    plant: microwavePlant as unknown as StatechartPlant,
    cs: microwaveConcreteSyntax,
    as: microwaveAbstractSyntax,
  },
  "digital watch": {
    plant: digitalWatchPlant as unknown as StatechartPlant,
    cs: dwatchConcreteSyntax,
    as: dwatchAbstractSyntax,
  },
  "traffic light": {
    plant: trafficLightPlant as unknown as StatechartPlant,
    cs: trafficLightConcreteSyntax,
    as: trafficLightAbstractSyntax,
  }
};
