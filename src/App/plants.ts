import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { digitalWatchPlant, dwatchConcreteSyntax } from "./Plant/DigitalWatch/DigitalWatch";
import { dummyPlant } from "./Plant/Dummy/Dummy";
import { microwaveConcreteSyntax, microwavePlant } from "./Plant/Microwave/Microwave";
import { Plant } from "./Plant/Plant";
import { trafficLightConcreteSyntax, trafficLightPlant } from "./Plant/TrafficLight/TrafficLight";

export type UniversalPlantState = {[property: string]: boolean|number};

export const plants: [string, Plant<any, UniversalPlantState>, ConcreteSyntax | null][] = [
  ["dummy", dummyPlant, null],
  ["microwave", microwavePlant as unknown as Plant<any, UniversalPlantState>, microwaveConcreteSyntax],
  ["digital watch", digitalWatchPlant as unknown as Plant<any, UniversalPlantState>, dwatchConcreteSyntax],
  ["traffic light", trafficLightPlant as unknown as Plant<any, UniversalPlantState>, trafficLightConcreteSyntax],
];
