import { GRID_CELL_SIZE } from "../parameters";

export function Grid({width, height}: {width: number, height: number}) {
  return <>
    {Array.from({length: width/GRID_CELL_SIZE}).map((_,i) => 
      <line key={'v'+i*GRID_CELL_SIZE} x1={i*GRID_CELL_SIZE} x2={i*GRID_CELL_SIZE} y1={0} y2={height} strokeWidth={0.5} stroke="black" style={{pointerEvents: 'none'}}/>)}
    {Array.from({length: height/GRID_CELL_SIZE}).map((_,i) => 
      <line key={'h'+i*GRID_CELL_SIZE} x1={0} x2={width} y1={i*GRID_CELL_SIZE} y2={i*GRID_CELL_SIZE} strokeWidth={0.5} stroke="black" style={{pointerEvents: 'none'}}/>)}
  </>
}
