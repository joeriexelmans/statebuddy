import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { digitalWatchPlant, dwatchConcreteSyntax } from "./Plant/DigitalWatch/DigitalWatch";
import { microwaveConcreteSyntax, microwavePlant } from "./Plant/Microwave/Microwave";
import { Plant } from "./Plant/Plant";
import { trafficLightConcreteSyntax, trafficLightPlant } from "./Plant/TrafficLight/TrafficLight";
import { Statechart2DEVSState } from "@/devs/sc2devs";

export type UniversalPlantState = {[property: string]: boolean|number};

// A plant that is implemented as a Statechart
type StatechartPlant = Plant<Statechart2DEVSState, UniversalPlantState>;

export const plants: [string, StatechartPlant, ConcreteSyntax][] = [
  ["microwave", microwavePlant as unknown as StatechartPlant, microwaveConcreteSyntax],
  ["digital watch", digitalWatchPlant as unknown as StatechartPlant, dwatchConcreteSyntax],
  ["traffic light", trafficLightPlant as unknown as StatechartPlant, trafficLightConcreteSyntax],
];

export function lookupPlant(name: string): StatechartPlant|undefined {
  return plants.find(([plantName]) => plantName === name)?.[1];
}
