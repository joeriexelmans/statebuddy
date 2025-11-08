import { digitalWatchPlant } from "./Plant/DigitalWatch/DigitalWatch";
import { dummyPlant } from "./Plant/Dummy/Dummy";
import { microwavePlant } from "./Plant/Microwave/Microwave";
import { Plant } from "./Plant/Plant";
import { trafficLightPlant } from "./Plant/TrafficLight/TrafficLight";

export type UniversalPlantState = {[property: string]: boolean|number};

export const plants: [string, Plant<any, UniversalPlantState>][] = [
  ["dummy", dummyPlant],
  ["microwave", microwavePlant as unknown as Plant<any, UniversalPlantState>],
  ["digital watch", digitalWatchPlant as unknown as Plant<any, UniversalPlantState>],
  ["traffic light", trafficLightPlant as unknown as Plant<any, UniversalPlantState>],
];
