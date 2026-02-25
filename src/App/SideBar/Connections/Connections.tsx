import { Toolbar } from "@/App/TopPanel/Toolbar";
import { Dispatch, SetStateAction, useState } from "react";
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { DoubleClickButton } from "@/App/Components/DoubleClickButton";
import styles from "./Connections.module.css";
import { Tooltip } from "@/App/Components/Tooltip";

const COLORS = [
  "blue",
  "red",
  "green",
  "yellow"
];

// export function Connections({conns, setConns}: {conns: Conns, setConns: Dispatch<SetStateAction<Conns>>}) {
//   const outputs = {
//     sc: ["ready", "hoist", "move", "magnetOn", "magnetOff", "stopAllMovement"],
//     microwave: ["startPressed", "startReleased", "stopPressed", "stopReleased", "incTimePressed", "incTimeReleased"],
//     microwaveUI: ["doorMouseDown", "doorMouseUp", "startMouseDown", "startMouseUp", "stopMouseDown", "stopMouseUp", "incTimeMouseDown", "incTimeMouseUp"],
//   };
//   const inputs = {
//     sc: ["doneMoving", "makeMove", "emergencyStop", "emergencyResume", "setTargetX", "setTargetY"],
//     microwave: ["ringBell", "setMagnetron", "setTimeDisplay", "doorMouseDown", "doorMouseUp", "startMouseDown", "startMouseUp", "stopMouseDown", "stopMouseUp", "incTimeMouseDown", "incTimeMouseUp"],
//   };

//   // let row = 1;

//   console.log(conns);

//   const entries = Object.entries(conns).sort(([srcA], [srcB]) => srcA.localeCompare(srcB));

//   return <>
//     <Toolbar>
//       <DoubleClickButton tooltip="" align="left"
//         onDoubleClick={() => setConns({})}>
//         <DeleteOutlineIcon fontSize="small"/> clear all
//       </DoubleClickButton>
//       <Tooltip tooltip="simple name-based matching of input- and output-events">
//         <button>
//           <AutoAwesomeIcon fontSize="small"/> auto-generate connections
//         </button>
//       </Tooltip>
//     </Toolbar>

//     <div className={styles.grid} style={{
//       display: 'grid',
//       gridTemplateColumns: '1fr 30px 1fr 30px',
//       alignItems: 'center',
//     }}>
//       {entries.map(([src, [tgtSys, tgtEvent]], i) => <>
//         <div style={{display: 'contents'}}>
//           <div style={{gridColumn: 1, gridRow: i+1, textAlign: 'left'}}>
//             {src}
//           </div>
//           <div style={{gridColumn: 2, gridRow: i+1, textAlign: 'center'}}>
//             →
//           </div>
//           <div style={{gridColumn: 3, gridRow: i+1}}>
//             {tgtSys}.{tgtEvent}
//           </div>
//           <div style={{gridColumn: 4, gridRow: i+1}}>
//             <Toolbar>
//               <DoubleClickButton tooltip="delete connection" align="right">
//                 <DeleteOutlineIcon fontSize="small"/>
//               </DoubleClickButton>
//             </Toolbar>
//           </div>
//         </div>
//       </>)}

//       <div style={{gridColumn: 1, gridRow: entries.length+1, textAlign: 'left'}}>
//         <select style={{textAlign: 'left', width: '100%'}}>
//           <option>output event...</option>
//           {Object.entries(outputs).map(([system, events]) => events.map(event =>
//             <option style={{fontStyle: 'oblique'}}>{system}.{event}</option>))}
//         </select>
//       </div>
//       <div style={{gridColumn: 2, gridRow: entries.length+1, textAlign: 'center'}}>
//         →
//       </div>
//       <div style={{gridColumn: 3, gridRow: entries.length+1}}>
//         <select style={{width: '100%'}}>
//           <option>input event...</option>
//           {Object.entries(inputs).map(([system, events]) => events.map(event => <option>{system}.{event}</option>))}
//         </select>
//       </div>
//       <div style={{gridColumn: 4, gridRow: entries.length+1}}>
//           <Toolbar><button><AddIcon fontSize="small"/></button></Toolbar>
//       </div>
//     </div>    
//   </>




  // const conns = {

  // }

  // let outputCtr = 0;
  // let inputCtr = 0;

  // const width = 160;
  // const height = 20;
  // const gap = 20;
  // const vGap = 10;

  // return <svg width={400} height={700}>
  //   {Object.entries(outputs).map(([system, events], i) => events.map(event =>
  //     <>
  //       <rect x={0} y={(vGap+height)*(outputCtr++)} width={width} height={height} fill={COLORS[i]}/>
  //       <text x={0 + width/2} y={-15+(vGap+height)*outputCtr} fill="white" textAnchor="middle">{system}.{event}</text>
  //     </>
  //   ))}
  //   {Object.entries(inputs).map(([system, events], i) => events.map(event =>
  //     <>
  //       <rect x={width + gap} y={(vGap+height)*(inputCtr++)} width={width} height={height} fill={COLORS[i]}/>
  //       <text x={width + gap + width/2} y={-15+(vGap+height)*inputCtr} fill="white" textAnchor="middle">{system}.{event}</text>
  //     </>
  //   ))}
  // </svg>;
// }