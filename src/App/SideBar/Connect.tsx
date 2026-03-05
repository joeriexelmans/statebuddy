import connectStyles from "./Connect.module.css";


import { Model2ModelConn } from "@/devs/coupled_devs"
import { Statechart } from "@/statecharts/abstract_syntax";
import { PlantsState } from "../hooks/useSimulator";
import traceStyles from "./Trace.module.css";
import { useMemo, useState } from "react";
import { WithSetters } from "../makePartialSetter";

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DoubleClickButton } from "../Components/DoubleClickButton";
import { Tooltip } from "../Components/Tooltip";
import { statebuddyPlants } from "../plants";

type ConnectProps = {
  ast: Statechart,
} & WithSetters<{
  plantsState: PlantsState,
}>;

function fullEventName(componentName: string, eventName: string) {
  if (componentName === "") {
    return eventName;
  }
  else return `${componentName}.${eventName}`;
}

function Connections({conns, startIdx, componentNames, actions, bgColor}: {
  conns: Model2ModelConn[],
  startIdx: number,
  componentNames: {[id: string]: string},
  actions: (i: number) => any,
  bgColor?: string,
}) {
  return conns.map((conn, i) =>
    <div key={`${i}-${conn.outputModelName}-${conn.outputEvent}->${conn.inputModelName}-${conn.inputEvent}`} style={{display: 'contents'}}>
      <div className={connectStyles.row} style={{gridColumn: '1/-1', gridRow: startIdx+i, backgroundColor: bgColor, height: '1.2lh'}}>
              </div>
      <div style={{gridColumn: 1, gridRow: startIdx+i}}>
        <div className={traceStyles.outputEvent}>
          &#8599;
          {fullEventName(componentNames[conn.outputModelName], conn.outputEvent)}
        </div>
      </div>
      <div style={{gridColumn: 2, gridRow: startIdx+i, textAlign: 'center'}}>&rarr;</div>
      <div style={{gridColumn: 3, gridRow: startIdx+i}}>
        <div className={traceStyles.inputEvent}>
          &#8600;
          {fullEventName(componentNames[conn.inputModelName], conn.inputEvent)}
          </div>
      </div>
      <div style={{gridColumn: 4, gridRow: startIdx+i, textAlign: 'right'}}>
        {actions(i)}
      </div>
    </div>
  );
}

export function Connect({ast, plantsState, setPlantsState}: ConnectProps) {
  const [selectedOutput, setSelectedOutput] = useState("-1");
  const [selectedInput, setSelectedInput] = useState("-1");
  const plants = plantsState.plants.map(({id, type}) => [id, statebuddyPlants[type]!] as const);
  const names = Object.fromEntries([
    ['sc', ''],
    ...plantsState.plants.map(({id, name}) => [id, name]),
  ]);
  const allOutputs = [
    ...[...ast.outputEvents].map(eventName =>
        ['sc', eventName] as const),
    ...plants.flatMap(([plantId, plant]) =>
        plant.plant.execution.outputs.map(eventName =>
          [plantId, eventName] as const)),
  ];
  const allInputs = [
    ...ast.inputEvents.map(({event}) =>
        ['sc', event] as const),
    ...plants.flatMap(([plantId, plant]) =>
        plant.plant.execution.inputs.map(eventName =>
          [plantId, eventName] as const)),
  ];
  const findMatchingEvent = (selectedIdx: string, selectedArray: (readonly [string, string])[], arrayToSearch: (readonly [string, string])[], currIdx: string) => {
    if (currIdx === "-1") {
      if (selectedIdx !== "-1") {
        const found = arrayToSearch.findIndex(([_, event]) => event === selectedArray[Number(selectedIdx)][1]);
        return found.toString();
      }
    }
    return currIdx;
  }
  const suggestions = useMemo(() => autoConnect(allOutputs, allInputs, plantsState.conns), [allOutputs, allInputs, plantsState.conns]);
  return <>
    <div className={connectStyles.grid} style={{
      display: 'grid',
      gridTemplateColumns: '1fr 20px 1fr auto',
      // columnGap: '0.5em',
      alignItems: 'center',
    }}>
      <Connections
        conns={plantsState.conns}
        componentNames={names}
        startIdx={1}
        actions={(i: number) =>
          <DoubleClickButton
            tooltip="delete connection"
            align="right"
            onDoubleClick={() => setPlantsState(ps => ({
              ...ps,
              conns: ps.conns.toSpliced(i, 1),
            }))}
          >
            <DeleteOutlineIcon fontSize="small"/>
          </DoubleClickButton>

        }
      />
      <div style={{gridColumnStart: 1, gridColumnEnd: 5, gridRow: plantsState.conns.length+1}}>
        <DoubleClickButton
          tooltip="remove all connections"
          style={{width: '100%'}}
          onDoubleClick={() => setPlantsState(ps => ({...ps, conns: []}))}
          disabled={plantsState.conns.length === 0}
          fullWidth
        >
          <DeleteOutlineIcon fontSize="small"/>
          clear all
        </DoubleClickButton>
      </div>
      <div style={{gridColumnStart: 1, gridColumnEnd: 5, gridRow: plantsState.conns.length+2}}>
        {/* <hr/> */}
      </div>
      <Connections
        componentNames={names}
        conns={suggestions}
        startIdx={plantsState.conns.length+3}
        actions={(i: number) =>
          <Tooltip tooltip="add connection" align="right">
            <button onClick={() => setPlantsState(ps => ({...ps, conns: [...ps.conns, suggestions[i]]}))}>
              <AddIcon fontSize="small"/>
            </button>
          </Tooltip>}
        bgColor="var(--statusbar-bg-color)"
      />
      {suggestions.length > 0 &&
        <div style={{gridColumn: '1/5', gridRow: plantsState.conns.length+suggestions.length+3}}>
          <DoubleClickButton
            tooltip='add all suggested connections (above)'
            fullWidth
            style={{width: '100%'}}
            onDoubleClick={() => setPlantsState(ps => ({...ps, conns: [...ps.conns, ...suggestions]}))}
          >
            <AddIcon fontSize="small"/>
            add all
          </DoubleClickButton>
        </div>}
      <div style={{gridColumn: 1, gridRow: plantsState.conns.length+suggestions.length+4}}>
        <select
          className={traceStyles.outputEvent}
          value={selectedOutput}
          onChange={e => {
            setSelectedOutput(e.target.value);
            setSelectedInput(si => findMatchingEvent(e.target.value, allOutputs, allInputs, si))
          }}
        >
          <option style={{fontStyle: 'italic'}} value="-1"></option>
          {allOutputs.map(([componentId, outputEvent], i) =>
            <option value={i} key={`${i}-${componentId}-${outputEvent}`}>
              &#8599;
              {fullEventName(names[componentId], outputEvent)}
            </option>)}
        </select>
      </div>
      <div style={{gridColumn: 2, gridRow: plantsState.conns.length+suggestions.length+4, textAlign: 'center'}}>
        &rarr;
      </div>
      <div style={{gridColumn: 3, gridRow: plantsState.conns.length+suggestions.length+4}}>
        <select
          className={traceStyles.inputEvent}
          value={selectedInput}
          onChange={e => {
            setSelectedInput(e.target.value);
            setSelectedOutput(si => findMatchingEvent(e.target.value, allInputs, allOutputs, si));
          }}
        >
          <option style={{fontStyle: 'italic'}} value="-1"></option>
          {allInputs.map(([componentId, inputEvent], i) =>
            <option value={i} key={`${i}-${componentId}-${inputEvent}`}>
              &#8600;
              {fullEventName(names[componentId], inputEvent)}
            </option>)}
        </select>
      </div>
      <div style={{gridColumn: 4, gridRow: plantsState.conns.length+suggestions.length+4}}>
        <Tooltip tooltip="add connection" align="right">
          <button
            disabled={selectedInput === "-1" || selectedOutput === "-1"}
            onClick={() => {
              const [fromComponent, fromOutputEvent] = allOutputs[Number(selectedOutput)];
              const [toComponent, toInputEvent] = allInputs[Number(selectedInput)];
              setPlantsState(ps => ({
                ...ps,
                conns: [
                  ...ps.conns,
                  {
                    outputModelName: fromComponent,
                    outputEvent: fromOutputEvent,
                    inputModelName: toComponent,
                    inputEvent: toInputEvent,
                  },
                ],
              }));
              setSelectedInput("-1");
              setSelectedOutput("-1");
            }}
          >
            <AddIcon fontSize="small"/>
          </button>
        </Tooltip>
      </div>
      {/* <div style={{gridColumn: '1/5', gridRow: plantsState.conns.length+suggestions.length+5}}>
        hard-wired:
      </div>
      <Connections
        actions={() => <></>}
        componentNames={names}
        conns={
          []
        }
        bgColor="darkgreen"
        startIdx={plantsState.conns.length+suggestions.length+6}/> */}
    </div>
  </>;
}

function autoConnect(allOutputs: (readonly [string, string])[], allInputs: (readonly [string, string])[], alreadyHave: Model2ModelConn[]) {
  return allOutputs.flatMap(([outputModelName, outputEvent]) =>
    allInputs.flatMap(([inputModelName, inputEvent]) =>
      (outputEvent === inputEvent && !alreadyHave.some(entry => entry.outputModelName === outputModelName && entry.outputEvent === outputEvent && entry.inputModelName === inputModelName && entry.inputEvent === inputEvent)) ? [{
        outputModelName, outputEvent, inputModelName, inputEvent
      }] : []))
}
