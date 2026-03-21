import connectStyles from "./Connect.module.css";


import { Model2ModelConn } from "@/devs/coupled_devs"
import { Statechart } from "@/statecharts/abstract_syntax";
import { PlantsState } from "../migrations/v1_types";
import traceStyles from "./Trace.module.css";
import { memo, useCallback, useMemo } from "react";
import { DeepSetter, WithSetters } from "../makePartialSetter";

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DoubleClickButton } from "../Components/DoubleClickButton";
import { Tooltip } from "../Components/Tooltip";
import { statebuddyPlants } from "../plants";
import { objectsEqual } from "@/util/util";
import { useLocalStorage } from "@/hooks/usePersistentState";
import { Plant } from "../Plant/Plant";

type ConnectProps = {
  abstractSyntax: Statechart,
  plantsState: PlantsState,
  setPlantsState: DeepSetter<PlantsState>,
};

function fullEventName(componentName: string, eventName: string) {
  if (componentName === "") {
    return eventName;
  }
  else return `${componentName}.${eventName}`;
}

const inoutStyle = {
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  maxWidth: '100%',
}

// helper for rendering a bunch of connections in a CSS grid
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
        <div className={traceStyles.outputEvent} style={inoutStyle}>
          &#8599;
          {fullEventName(componentNames[conn.outputModelName], conn.outputEvent)}
        </div>
      </div>
      <div style={{gridColumn: 2, gridRow: startIdx+i, textAlign: 'center'}}>&rarr;</div>
      <div style={{gridColumn: 3, gridRow: startIdx+i}}>
        <div className={traceStyles.inputEvent} style={inoutStyle}>
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

export function useConnect(abstractSyntax: Statechart, plantsState: PlantsState) {
  return useMemo(() => {
    const plants = plantsState.plants.map(({id, type}) => [id, statebuddyPlants[type]!] as const);
    const allOutputs = [
      ...[...abstractSyntax.outputEvents].map(eventName =>
          ['sc', eventName] as const),
      ...plants.flatMap(([plantId, plant]) =>
          plant.plant.execution.outputs.map(eventName =>
            [plantId, eventName] as const)),
    ];
    const allInputs = [
      ...abstractSyntax.inputEvents.map(({event}) =>
          ['sc', event] as const),
      ...plants.flatMap(([plantId, plant]) =>
          plant.plant.execution.inputs.map(eventName =>
            [plantId, eventName] as const)),
    ];
    const suggestions = autoConnect(allOutputs, allInputs, plantsState.conns);
    return [allOutputs, allInputs, suggestions] as const;
  }, [abstractSyntax, plantsState]);
}

export const Connect = memo(function Connect({abstractSyntax, plantsState, setPlantsState: {setConns}}: ConnectProps) {
  const [selectedOutput, setSelectedOutput] = useLocalStorage("connect.selectedOutput", "-1");
  const [selectedInput, setSelectedInput] = useLocalStorage("connect.selectedInput", "-1");
  const names = Object.fromEntries([
    ['sc', ''],
    ...plantsState.plants.map(({id, name}) => [id, name]),
  ]);
  const findMatchingEvent = (selectedIdx: string, selectedArray: (readonly [string, string])[], arrayToSearch: (readonly [string, string])[], currIdx: string) => {
    if (currIdx === "-1") {
      if (selectedIdx !== "-1") {
        const found = arrayToSearch.findIndex(([_, event]) => event === selectedArray[Number(selectedIdx)][1]);
        return found.toString();
      }
    }
    return currIdx;
  }
  const [allOutputs, allInputs, suggestions] = useConnect(abstractSyntax, plantsState);

  const deleteConnection = useCallback((i: number) => {
    setConns(conns => conns.toSpliced(i, 1));
  }, [setConns]);
  const showDeleteButton = useCallback((i: number) => {
    return <DoubleClickButton
      tooltip="delete connection"
      align="right"
      onDoubleClick={() => deleteConnection(i)}
    >
      <DeleteOutlineIcon fontSize="small"/>
    </DoubleClickButton>;
  }, [deleteConnection]);

  // cannot connect component to itself (against the rules of DEVS):
  const endpointMissing = allInputs[Number(selectedInput)] === undefined || allOutputs[Number(selectedOutput)] === undefined;
  const attemptingSelfConnect = !endpointMissing && allInputs[Number(selectedInput)][0] === allOutputs[Number(selectedOutput)][0];

  return <>
    <div className={connectStyles.grid} style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 20px minmax(0, 1fr) auto',
      alignItems: 'center',
    }}>
      <Connections
        conns={plantsState.conns}
        componentNames={names}
        startIdx={1}
        actions={showDeleteButton}
      />
      <div style={{gridColumnStart: 1, gridColumnEnd: 5, gridRow: plantsState.conns.length+1}}>
        <DoubleClickButton
          tooltip="remove all connections"
          style={{width: '100%'}}
          onDoubleClick={() => setConns([])}
          disabled={plantsState.conns.length === 0}
          fullWidth
        >
          <DeleteOutlineIcon fontSize="small"/>
          clear all
        </DoubleClickButton>
      </div>
      <div style={{gridColumnStart: 1, gridColumnEnd: 5, gridRow: plantsState.conns.length+2}}>
      </div>
      <Connections
        componentNames={names}
        conns={suggestions}
        startIdx={plantsState.conns.length+3}
        actions={(i: number) =>
          <Tooltip tooltip="add connection" align="right">
            <button onClick={() => setConns(conns => [...conns, suggestions[i]])}>
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
            onDoubleClick={() => setConns(conns => [...conns, ...suggestions])}
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
          style={inoutStyle}
        >
          <option style={{fontStyle: 'italic'}} value="-1"></option>
          {allOutputs.map(([componentId, outputEvent], i) =>
            <option value={i} key={`${i}-${componentId}-${outputEvent}`}>
              &#8599;
              {fullEventName(names[componentId], outputEvent)}
            </option>)}
        </select>
      </div>

      {/* very shitty way of making the background pink if there's an error */}
      {attemptingSelfConnect &&
        <div style={{gridColumn: '1 / 5', gridRow: plantsState.conns.length+suggestions.length+4, backgroundColor: 'var(--error-bg-color)', height: '2.2em', zIndex: -1}}/>}

      <div style={{gridColumn: 2, gridRow: plantsState.conns.length+suggestions.length+4, textAlign: 'center'}}>
        {attemptingSelfConnect &&
          <Tooltip tooltip={<>
            Cannot connect component to itself.
            Theory on <a href="https://link.springer.com/content/pdf/10.1007/978-3-030-43946-0_5.pdf">Coupled DEVS</a>, page 136: &quot;A model should not influence itself&quot;.
          </>} showWhen="always" error>
            <span style={{fontWeight: "bold", color: 'var(--error-color)'}}>
            &rarr;
            </span>
          </Tooltip>
          ||
          <>&rarr;</>
        }
      </div>

      <div style={{gridColumn: 3, gridRow: plantsState.conns.length+suggestions.length+4}}>
        <select
          className={traceStyles.inputEvent}
          value={selectedInput}
          onChange={e => {
            setSelectedInput(e.target.value);
            setSelectedOutput(si => findMatchingEvent(e.target.value, allInputs, allOutputs, si));
          }}
          style={inoutStyle}
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
            disabled={endpointMissing || attemptingSelfConnect}
            onClick={() => {
              const [fromComponent, fromOutputEvent] = allOutputs[Number(selectedOutput)];
              const [toComponent, toInputEvent] = allInputs[Number(selectedInput)];
              setConns(conns => [
                  ...conns,
                  {
                    outputModelName: fromComponent,
                    outputEvent: fromOutputEvent,
                    inputModelName: toComponent,
                    inputEvent: toInputEvent,
                  },
                ]);
              setSelectedInput("-1");
              setSelectedOutput("-1");
            }}
          >
            <AddIcon fontSize="small"/>
          </button>
        </Tooltip>
      </div>
    </div>
  </>;
}, objectsEqual);

export function autoConnect(allOutputs: (readonly [string, string])[], allInputs: (readonly [string, string])[], alreadyHave: Model2ModelConn[]) {
  return allOutputs.flatMap(([outputModelName, outputEvent]) =>
    allInputs.flatMap(([inputModelName, inputEvent]) =>
      (outputEvent === inputEvent && !alreadyHave.some(entry => entry.outputModelName === outputModelName && entry.outputEvent === outputEvent && entry.inputModelName === inputModelName && entry.inputEvent === inputEvent)) ? [{
        outputModelName, outputEvent, inputModelName, inputEvent
      }] : []))
}
