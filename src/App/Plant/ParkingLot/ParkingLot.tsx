import { makeStatechartPlant, PlantRenderProps, StatechartPlantSpec } from "../Plant";
import fontDigital from "../DigitalWatch/digital-font.ttf";
import imgFire from "./artwork/fire.svg";

import parkingLotJSON from "./model.json";
import { parseStatechart } from "@/languages/statecharts/parser/parser";
import { computeTopology } from "@/languages/statecharts/parser/detect_topology";
import { ConcreteSyntax } from "@/languages/statecharts/concrete_syntax";
import { SC2DEVSNonError } from "@/languages/devs/sc2devs";

export const parkingLotConcreteSyntax = parkingLotJSON as ConcreteSyntax;

export const [parkingLotAbstractSyntax, parkingLotErrors] = parseStatechart(computeTopology(parkingLotConcreteSyntax));

type CarState = "nocar" | "waiting" | "passing" | "passed" | "accident";

type ParkingLotState = {
  ticket: boolean;
  canPay: boolean;

  numCars: number;
  capacity: number,
  countedCars: number;

  entryBarrierOpen: boolean;
  entryLightGreen: boolean; // false means red
  entryCar: CarState;

  exitBarrierOpen: boolean;
  exitLightGreen: boolean; // false means red
  exitCar: CarState;
}

const laserThin = 1.5;
const laserThick = 3;
const laserColor = "blue";

const asphaltColor = "#a2a2a2";

export function ParkingLot({state, speed, raiseUIEvent}: PlantRenderProps<ParkingLotState>) {
  return <>
<svg width="100%" xmlns="http://www.w3.org/2000/svg" style={{backgroundColor: "#88e292"}} viewBox="0 0 640 460">
  <style>{`
      @font-face{
        font-family: 'digital-font';
        src: url(${fontDigital});
      }
      text.counter {
        font-family: digital-font;
      }
  `}</style>
 <g transform="translate(-85,-65)">

  <SceneSVG/>


  {/* Ticket machine */}
  <rect id="svg_101" height="34.83729" width="24.18118" y="461.0924" x="535.27888" stroke="#000000" fill="#a7a7a7"/>
  <rect id="svg_103" height="3.2788" width="18.03342" y="472.97807" x="538.55768" stroke="#000000" fill="#000000"/>

  {/* Ticket from ticket machine */}
  {state.ticket && <rect id="svg_104" height="13.93492" width="10.65611" y="473.38792" x="542.65618" stroke="#000000" fill="#fff9ce"/>}

  {/* Payment machine */}
  <g transform="translate(30 50)">
  <rect id="svg_105" height="34.83729" width="24.18118" y="379.1223" x="237.7274" stroke="#000000" fill="#a7a7a7"/>
  <rect id="svg_106" height="3.2788" width="18.03342" y="391.00797" x="241.00619" stroke="#000000" fill="#000000"/>
  <text textAnchor="start" fontFamily="monospace" fontSize="24" strokeWidth="0" id="svg_108" y="378.71245" x="240.59636" stroke="#000000" fill="#000000">€</text>
  </g>

  {[0,1,2,3,4,5,6].splice(0, state.numCars).map(i => <g key={i} transform={`translate(${162+i*80+(2*i%3)} ${102+(i-1)%5})`}>
    {(i % 3 === 0) ? <CarBackSVG/> : <CarFrontSVG/>}
  </g>)}
  




  {/* Entry sensors */}

  <line x1={570} x2={680-15} y1={455} y2={455} stroke={laserColor} strokeWidth={(state.entryCar === "passed" || state.entryCar === "passing") ? laserThick : laserThin} strokeDasharray="5 5"/>
  <line x1={570} x2={680-15} y1={482} y2={482} stroke={laserColor} strokeWidth={(state.entryCar === "waiting" || state.entryCar === "passing") ? laserThick : laserThin} strokeDasharray="5 5"/>


  {/* Exit sensors */}
  <line x1={130} x2={240-15} y1={455} y2={455} stroke={laserColor} strokeWidth={(state.exitCar === "waiting" || state.exitCar === "passing") ? laserThick : laserThin} strokeDasharray="5 5"/>
  <line x1={130} x2={240-15} y1={482} y2={482} stroke={laserColor} strokeWidth={(state.exitCar === "passed" || state.exitCar === "passing") ? laserThick : laserThin} strokeDasharray="5 5"/>

  {(state.exitCar === "passed") && <g transform="translate(190 440)">
    <CarFrontSVG/>
  </g>}
  {(state.exitCar === "passing") && <g transform="translate(190 420)">
    <CarFrontSVG/>
  </g>}
  {(state.exitCar === "accident") && <g transform="translate(190 420)">
    <CarFrontSVG onFire/>
  </g>}
  {(state.exitCar === "waiting") && <g transform="translate(190 400)">
    <CarFrontSVG/>
  </g>}

  {(state.entryCar === "waiting") && <g transform="translate(615 440)">
    <CarBackSVG/>
  </g>}
  {(state.entryCar === "passing") && <g transform="translate(615 420)">
    <CarBackSVG/>
  </g>}
  {(state.entryCar === "accident") && <g transform="translate(615 420)">
    <CarBackSVG onFire/>
  </g>}
  {(state.entryCar === "passed") && <g transform="translate(615 400)">
    <CarBackSVG/>
  </g>}

  {/* Entry barrier */}
  <g transform="translate(697 435)">
    <BarrierSVG isOpen={state.entryBarrierOpen}/>
  </g>

  {/* Exit barrier */}
  <g transform="translate(110 435) scale(-1 1)">
    <BarrierSVG isOpen={state.exitBarrierOpen}/>
  </g>

  {/* Sensor text */}
  <text x={680-12} y={455+5} fill="blue" textAnchor="start">S1</text>
  <text x={680-12} y={482+5} fill="blue" textAnchor="start">S0</text>
  <text x={240-12} y={455+5} fill="blue" textAnchor="start">S2</text>
  <text x={240-12} y={482+5} fill="blue" textAnchor="start">S3</text>


  <g transform="translate(320 440)">
    <TrafficLight isGreen={state.exitLightGreen}/>
  </g>

  <g transform="translate(510 470)">
    <TrafficLight isGreen={state.entryLightGreen}/>
    <g transform="translate(-34 10)">
    <rect width={40} height={32} x={-32} y={-24}/>
    <text className="counter" textAnchor="end" x={0} y={0} fill={(state.capacity - state.countedCars > 0) ? "rgb(57, 239, 120)" : "#f00"} fontSize={28}>{state.capacity - state.countedCars}</text>
    </g>
  </g>
 </g>
</svg>
<div style={{fontWeight: 'bolder', width: '100%'}}>
  <div style={{width: '100%', }}>
    <button style={{width: '50%'}}
      disabled={state.exitCar === "nocar" || state.exitCar === "waiting" && state.numCars === state.capacity || state.exitCar === "passed" && !state.exitBarrierOpen || state.exitCar === "accident"}
      onClick={() => raiseUIEvent({name: "exReverse"})}>🠝 {{"nocar": "", "waiting": "UN-LEAVE (RE-PARK)", "passing": "REVERSE", "passed": "REVERSE", "accident": "ACCIDENT!"}[state.exitCar]} 🠝</button>
    <button style={{width: '50%'}}
      disabled={(state.entryCar === "passing" || state.entryCar === "waiting") && !state.entryBarrierOpen || state.entryCar === "accident"}
      onClick={() => raiseUIEvent({name: "entrProceed"})}>🠝 {{"nocar": "ARRIVE", "waiting": "DRIVE", "passing": "DRIVE", "passed": "PARK", "accident": "ACCIDENT!"}[state.entryCar]} 🠝</button>
  </div>
  <div style={{width: '100%', }}>
    <button style={{width: '50%'}}
      disabled={state.exitCar !== "waiting"}
      onClick={() => raiseUIEvent({name: state.canPay ? "pay" : "insertTicket"})}>{state.exitCar === "waiting" ? state.canPay ? "PAY" : "INSERT TICKET" : "_"}</button>
    <button style={{width: '50%'}}
      disabled={state.entryCar !== "waiting" || !state.ticket}
      onClick={() => raiseUIEvent({name: "takeTicket"})}>TAKE TICKET</button>
  </div>
  <div style={{width: '100%'}}>
    <button style={{width: '50%'}}
      disabled={state.numCars === 0 && state.exitCar === "nocar" || state.exitCar === "accident" || state.exitCar === "waiting" && !state.exitBarrierOpen}
      onClick={() => raiseUIEvent({name: "exProceed"})}>🠟 {{"nocar": "LEAVE", "waiting": "LEAVE", "passing": "LEAVE", "passed": "LEAVE", "accident": "ACCIDENT!"}[state.exitCar]} 🠟</button>
    <button style={{width: '50%'}}
      disabled={state.entryCar === "nocar" || state.entryCar === "passed" && !state.entryBarrierOpen || state.entryCar === "accident"}
      onClick={() => raiseUIEvent({name: "entrReverse"})}>🠟 {{"nocar": "", "waiting": "REVERSE (LEAVE)", "passing": "REVERSE", "passed": "REVERSE", "accident": "ACCIDENT!"}[state.entryCar]} 🠟</button>
  </div>
  <div style={{width: '100%', height: 12}}></div>
  <div style={{width: '100%'}}>
    <button style={{width: '50%'}} disabled={false} onClick={() => raiseUIEvent({name: "openExit"})}>MANUALLY OPEN BARRIER</button>
    <button style={{width: '50%'}} disabled={false} onClick={() => raiseUIEvent({name: "openEntry"})}>MANUALLY OPEN BARRIER</button>
  </div>
  </div>
  </>;
}

export function TrafficLight({isGreen}: {isGreen: boolean}) {
  const blackR = 14;
  const lightR = 8;
  const distBetweenLights = lightR*2.6;
 return <g><g transform={`translate(0 -${distBetweenLights/2})`}>
    <rect x={-blackR} y={0} width={blackR*2} height={distBetweenLights} fill="black"/>
    <g transform={`translate(${0} ${distBetweenLights})`}>
      <circle fill="black" r={blackR}/>
    </g>
    <g transform={`translate(${0} ${0})`}>
      <circle fill="black" r={blackR}/>
      {!isGreen && <circle fill="red" r={lightR}/>}
    </g>
    {isGreen && <g transform={`translate(${0} ${distBetweenLights})`}>
      <circle fill="rgb(57, 239, 120)" r={lightR}/>
    </g>}
  </g>
    {/* <circle r="2" fill="yellow"/> */}
  </g>
}

function TreeSVG() {
  return (<g transform="translate(-65 -330)">
  <g id="svg_69">
   <rect id="svg_67" height="55.73967" width="14.75462" y="357.40022" x="64.36064" stroke="#000" fill="#592300"/>
   <ellipse ry="32.78804" rx="22.33685" id="svg_68" cy="338.5471" cx="70.71332" stroke="#000" fill="#267f00"/>
  </g>
  </g>
  );
}

export function SceneSVG() {
  return <g>
  {/* Trees */}
  {/* <g transform="translate(50 100)">
    <TreeSVG/>
  </g>
  <g transform="translate(20 180)">
    <TreeSVG/>
  </g>
  <g transform="translate(750 200)">
    <TreeSVG/>
  </g>
  <g transform="translate(700 50)">
    <TreeSVG/>
  </g>
  <g transform="translate(780 120)">
    <TreeSVG/>
  </g> */}

  {/* Main parking area */}
  <rect strokeOpacity="0" id="svg_32" height="182.53165" width="577.56977" y="102.48778" x="110.74481"  fill={asphaltColor}/>

  {/* Entry road */}
  <rect strokeOpacity="0" id="svg_34" height="255.25344" width="92.35666" y="283.81516" x="577.43955" fill={asphaltColor}/>

  {/* Exit road */}
  <rect strokeOpacity="0" id="svg_33" height="255.25344" width="92.35666" y="283.08162" x="135.9259"  fill={asphaltColor}/>

  {/* Parking spots */}
  <rect strokeWidth="4" fillOpacity="0" id="svg_42" height="77.90675" width="80.09078" y="110.7646" x="119.20032" stroke="#ffffff" fill="#ffffff"/>
  <rect strokeWidth="4" fillOpacity="0" id="svg_110" height="77.90675" width="80.09078" y="111.17445" x="199.12116" stroke="#ffffff" fill="#ffffff"/>
  <rect strokeWidth="4" fillOpacity="0" id="svg_111" height="77.90675" width="80.09078" y="111.17445" x="278.63217" stroke="#ffffff" fill="#ffffff"/>
  <rect strokeWidth="4" fillOpacity="0" id="svg_112" height="77.90675" width="80.09078" y="111.5843" x="358.96286" stroke="#ffffff" fill="#ffffff"/>
  <rect strokeWidth="4" fillOpacity="0" id="svg_113" height="77.90675" width="80.09078" y="111.99415" x="438.88373" stroke="#ffffff" fill="#ffffff"/>
  <rect strokeWidth="4" fillOpacity="0" id="svg_114" height="77.90675" width="80.09078" y="112.404" x="519.21442" stroke="#ffffff" fill="#ffffff"/>
  <rect strokeWidth="4" fillOpacity="0" id="svg_115" height="77.90675" width="80.09078" y="112.404" x="599.13525" stroke="#ffffff" fill="#ffffff"/>

  {/* White arrows */}
  <path transform="rotate(-89.9033, 624.002, 312.965)" id="svg_97" d="m621.39124,320.4345l9.10639,-4.61353l-17.60677,0l-17.60673,0l0,-2.85599l0,-2.856l17.40475,0c9.5726,0 17.40473,-0.14476 17.40473,-0.32168c0,-0.17692 -3.81082,-2.25301 -8.46848,-4.61353l-8.46851,-4.29185l7.82749,0l7.82746,0l11.9543,6.04732l11.9543,6.04731l-11.97723,6.03574l-11.97723,6.03574l-8.24044,0l-8.24046,0l9.10642,-4.61353l0,0z" strokeOpacity="0" stroke="#0f0f00" fill="#ffffff"/>
  <path transform="rotate(89.9627, 183.823, 315.014)" id="svg_98" d="m181.2118,322.48375l9.10639,-4.61353l-17.60677,0l-17.60673,0l0,-2.85599l0,-2.856l17.40475,0c9.5726,0 17.40473,-0.14476 17.40473,-0.32168c0,-0.17692 -3.81082,-2.25301 -8.46848,-4.61353l-8.46851,-4.29185l7.82749,0l7.82746,0l11.9543,6.04732l11.9543,6.04731l-11.97723,6.03574l-11.97723,6.03574l-8.24044,0l-8.24046,0l9.10642,-4.61353l0,0z" strokeOpacity="0" stroke="#0f0f00" fill="#ffffff"/>

  </g>
}

export function BarrierSVG({isOpen}: {isOpen: boolean}) {
  return (<g>
      <g transform={`rotate(${90*Number(isOpen)})`}>
        <g transform="translate(-150 -5)">
          <rect width="170" height="16" stroke="#000" fill="#ff0f0f"/>
        </g>
      </g>
   <rect id="svg_2" height="40.99933" width="20" y="0" x="-13" stroke="#000" fill="#edda30"/>
  </g>)
}

export function CarBackSVG({onFire}: {onFire?: boolean}) {
  return (
    <g transform="scale(0.9)">
  <g transform="translate(-626,-432)">
   <rect id="svg_20" height="7.18181" width="11.9998" y="500.46745" x="593.69539" stroke="#000" fill="#4f4f4f"/>
   <rect id="svg_21" height="8.63625" width="11.9998" y="498.96748" x="642.69459" stroke="#000" fill="#4f4f4f"/>
   <rect id="svg_22" height="16.99972" width="69.49887" y="482.96774" x="589.19546" stroke="#000" fill="#d87578"/>
   <path id="svg_23" d="m589.55546,483.23281l12.74979,-19.99968l42.4993,0l12.74979,19.99968l-67.99888,0z" stroke="#000" fill="#ff6063"/>
   <path id="svg_24" d="m593.5554,481.23284l11.15607,-15.99974l37.18689,0l11.15606,15.99974l-59.49902,0z" stroke="#000" fill="#a0f7f7"/>
   <ellipse ry="3.81789" rx="3.81789" id="svg_28" cy="492.20611" cx="649.15981" stroke="#000" fill="#ff5656"/>
   <ellipse ry="3.9997" rx="4.1815" id="svg_29" cy="492.38791" cx="598.25457" stroke="#000" fill="#ff5656"/>
   <ellipse transform="rotate(-43.0731, 591.851, 457.646)" ry="2.11007" rx="2.18165" id="svg_30" cy="457.64578" cx="591.85141" stroke="#000" fill="#f40909"/>
   <line transform="rotate(-14.9016, 594.982, 469.481)" id="svg_31" y2="457.11788" x2="595.89105" y1="481.8433" x1="594.07304" stroke="#000" fill="none"/>
   <rect id="svg_47" height="8.0178" width="24.94427" y="487.34152" x="611.04528" stroke="#000" fill="#ffffff"/>
    <text transform="matrix(0.147225, 0, 0, 0.208965, 333.582, 369.66)" textAnchor="start" fontFamily="monospace" fontSize="24" strokeWidth="0" id="svg_48" y="590.24124" x="1895.22968" stroke="#ffffff" fill="#000000">I ♥️ MoSIS</text>
  </g>
  {onFire && <image href={imgFire} x={-25} y={-30} width={60}/>}
  </g>);
}

export function CarFrontSVG({onFire}: {onFire?: boolean}) {
  return (
    <g transform="scale(0.9)">
  <g transform="translate(-185,-340)">
   <rect id="svg_6" height="7.18181" width="11.9998" y="408.84236" x="152.41295" stroke="#000" fill="#4f4f4f"/>
   <rect id="svg_7" height="8.63625" width="11.9998" y="407.34239" x="201.41215" stroke="#000" fill="#4f4f4f"/>
   <rect id="svg_9" height="16.99972" width="69.49887" y="391.34265" x="147.91302" stroke="#000" fill="#d87578"/>
   <path id="svg_10" d="m148.27302,391.60772l12.74979,-19.99968l42.4993,0l12.74979,19.99968l-67.99888,0z" stroke="#000" fill="#ff6063"/>
   <path id="svg_11" d="m152.27296,389.60776l11.15607,-15.99974l37.18689,0l11.15606,15.99974l-59.49902,0z" stroke="#000" fill="#a0f7f7"/>
   {/* <line id="svg_12" y2="403.34246" x2="199.91217" y1="403.34246" x1="164.41275" stroke="#000" fill="none"/> */}
   <line id="svg_13" y2="399.30839" x2="199.33256" y1="399.672" x1="164.42611" stroke="#000" fill="none"/>
   <line id="svg_14" y2="396.39952" x2="199.33256" y1="396.39952" x1="164.42611" stroke="#000" fill="none"/>
   <ellipse ry="3.81789" rx="3.81789" id="svg_15" cy="400.58102" cx="207.87737" stroke="#000" fill="#ffff56"/>
   <ellipse ry="3.9997" rx="4.1815" id="svg_16" cy="400.76283" cx="156.97213" stroke="#000" fill="#ffff56"/>
   <ellipse transform="rotate(-43.0731, 199.656, 362.021)" ry="2.11007" rx="2.18165" id="svg_18" cy="362.021" cx="199.65616" stroke="#000" fill="#f40909"/>
   <line id="svg_19" y2="362.94751" x2="198.60534" y1="370.9469" x1="198.24173" stroke="#000" fill="none"/>
   <rect id="svg_49" height="8.0178" width="24.94427" y="401.35835" x="170.18229" stroke="#000" fill="#ffffff"/>
   <text transform="matrix(0.147225, 0, 0, 0.208965, 333.582, 369.66)" text-anchor="start" fontFamily="monospace" fontSize="24" strokeWidth="0" id="svg_50" y="180.73093" x="-1099.25502" stroke="#ffffff" fill="#000000">I ♥️ MoSIS</text>

  </g>
  {onFire && <image href={imgFire} x={-25} y={-30} width={60}/>}
  </g>);
}

const parkingLotPlantSpec: StatechartPlantSpec<ParkingLotState> = {
  ast: parkingLotAbstractSyntax,
  cleanupState: (state: SC2DEVSNonError) => {
    return {
      entryBarrierOpen: state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#entryBarrierOpen")!.uid),
      entryLightGreen: state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#entryGreen")!.uid,),
      entryCar: state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#entryNoCars")!.uid) ? "nocar"
              : state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#entryWaiting")!.uid,) ? "waiting"
              : state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#entryPassing")!.uid,) ? "passing"
              : state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#entryPassed")!.uid,) ? "passed"
              : "accident",

      exitBarrierOpen: state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#exitBarrierOpen")!.uid),
      exitLightGreen: state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#exitGreen")!.uid,),
      exitCar: state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#exitNoCars")!.uid) ? "nocar"
              : state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#exitWaiting")!.uid,) ? "waiting"
              : state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#exitPassing")!.uid,) ? "passing"
              : state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#exitPassed")!.uid,) ? "passed"
              : "accident",

      numCars: state.rtconfig.environment.get("numCars", {kind: "state", thing: parkingLotAbstractSyntax.root}),
      capacity: state.rtconfig.environment.get("capacity", {kind: "state", thing: parkingLotAbstractSyntax.root}),
      countedCars: state.rtconfig.environment.get("countedCars", {kind: "state", thing: parkingLotAbstractSyntax.root}),

      ticket: state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#ticket")!.uid,),
      canPay: state.rtconfig.mode.has(parkingLotAbstractSyntax.tag2State.get("#pay")!.uid,),
    }
  },
  render: ParkingLot,
  uiEvents: [
    {kind: "event", event: "entrProceed"},
    {kind: "event", event: "entrReverse"},

    {kind: "event", event: "exProceed"},
    {kind: "event", event: "exReverse"},

    {kind: "event", event: "takeTicket"},
    {kind: "event", event: "insertTicket"},
    {kind: "event", event: "pay"},

    {kind: "event", event: "openEntry"},
    {kind: "event", event: "openExit"},
  ],
  signals: [
    "s0", "s1", "s2", "s3",
  ],
}

export const parkingLotPlant = makeStatechartPlant(parkingLotPlantSpec);