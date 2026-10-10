import connectStyles from "./Connect.module.css";

import { Model2ModelConn } from "@/devs/coupled_devs"
import { Statechart } from "@/statecharts/abstract_syntax";
import traceStyles from "./Trace.module.css";
import { memo, useCallback, useMemo } from "react";

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import BlockIcon from '@mui/icons-material/Block';

import { objectsEqual } from "@/util/util";
import { useLocalStorage } from "@/hooks/usePersistentState";
import { DoubleClickButton } from "../../Components/DoubleClickButton";
import { Tooltip } from "../../Components/Tooltip";
import { DeepSetter } from "../../makePartialSetter";
import { PlantsState } from "../../migrations/v1_types";
import { statebuddyPlants } from "../../plants";
import { TwoStateButton } from "@/App/Components/TwoStateButton";
import { Toolbar } from "@/App/TopPanel/Toolbar";

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
function Connections({conns, startIdx, componentNames, actions, rowStyles, cellStyles}: {
  conns: Model2ModelConn[],
  startIdx: number,
  componentNames: {[id: string]: string},
  actions: (i: number) => any,
  rowStyles: {}[],
  cellStyles: {}[],
}) {
  return conns.map((conn, i) =>
    <div key={`${i}-${conn.outputModelName}-${conn.outputEvent}->${conn.inputModelName}-${conn.inputEvent}`} style={{display: 'contents'}}>
      <div className={connectStyles.row} style={{gridColumn: '1/-1', gridRow: startIdx+i, height: '1.4lh', ...rowStyles[i]}}>
      </div>
      <div style={{gridColumn: 1, gridRow: startIdx+i}}>
        <div className={traceStyles.outputEvent} style={{...inoutStyle, ...cellStyles[i]}}>
          &#8599;
          {fullEventName(componentNames[conn.outputModelName], conn.outputEvent)}
        </div>
      </div>
      <div style={{gridColumn: 2, gridRow: startIdx+i, textAlign: 'center'}}>&rarr;</div>
      <div style={{gridColumn: 3, gridRow: startIdx+i}}>
        <div className={traceStyles.inputEvent} style={{...inoutStyle, ...cellStyles[i]}}>
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
    const suggestions = autoConnect(allOutputs, allInputs, []);

    function findConn(conn: Model2ModelConn) {
      return plantsState.conns.find(elem => connEqual(elem, conn));
    }
    const suggestionsState = suggestions.map(sugg => {
      const found = findConn(sugg);
      const state = found ? (found.suppress ? "suppress" : "keep") : "undecided";
      return state;
    });
    const unsuppressedSuggestions = suggestionsState.map((state, i) => [state, i] as const).filter(([state]) => state !== "suppress").map(([_, i]) => suggestions[i]);
    const manuallyAdded = plantsState.conns.filter(a => !suggestions.find(b => connEqual(a, b)));
    const effectivelyConnected = [
      ...unsuppressedSuggestions,
      ...manuallyAdded,
    ];
    return {suggestions, suggestionsState, allInputs, allOutputs, manuallyAdded, effectivelyConnected};
  }, [abstractSyntax, plantsState]);
}

export const ConnectPanel = memo(function Connect({abstractSyntax, plantsState, setPlantsState: {setConns}}: ConnectProps) {
  const [selectedOutput, setSelectedOutput] = useLocalStorage("connect.selectedOutput", "-1");
  const [selectedInput, setSelectedInput] = useLocalStorage("connect.selectedInput", "-1");
  const names = Object.fromEntries([
    ['sc', ''],
    ...plantsState.plants.map(({id, name}) => [id, name]),
  ]);
  // const findMatchingEvent = (selectedIdx: string, selectedArray: (readonly [string, string])[], arrayToSearch: (readonly [string, string])[], currIdx: string) => {
  //   if (currIdx === "-1") {
  //     if (selectedIdx !== "-1") {
  //       const found = arrayToSearch.findIndex(([_, event]) => event === selectedArray[Number(selectedIdx)][1]);
  //       return found.toString();
  //     }
  //   }
  //   return currIdx;
  // }

  // const deleteConnection = useCallback((i: number) => {
  //   setConns(conns => conns.toSpliced(i, 1));
  // }, [setConns]);
  // const showDeleteButton = useCallback((i: number) => {
  //   return ;
  // }, [deleteConnection]);

  const {suggestions, suggestionsState, allInputs, allOutputs, manuallyAdded} = useConnect(abstractSyntax, plantsState);

  // cannot connect component to itself (against the rules of DEVS):
  const endpointMissing = allInputs[Number(selectedInput)] === undefined || allOutputs[Number(selectedOutput)] === undefined;
  const attemptingSelfConnect = !endpointMissing && allInputs[Number(selectedInput)][0] === allOutputs[Number(selectedOutput)][0];

  const allKeep = suggestionsState.every(s => s === "keep");
  const allSuppress = suggestionsState.every(s => s === "suppress");

  return <>
    <div className={connectStyles.grid} style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 20px minmax(0, 1fr) auto',
      alignItems: 'center',
    }}>
      {/* Buttons: enable/disable all */}
      {suggestions.length >= 2 &&
        <div style={{gridColumn: 4, gridRow: 1}}>
        <Toolbar>
          <Tooltip tooltip="enable all" align="right">
          <TwoStateButton active={allKeep}
            onClick={() => {
              setConns(conns => {
                const filtered = conns.filter(a => !suggestions.find(b => connEqual(a, b)));
                if (allKeep) {
                  return filtered;
                }
                else {
                  return [...filtered, ...suggestions];
                }
              });
            }}>
          <CheckIcon fontSize="small"/></TwoStateButton>
          </Tooltip>
          <Tooltip tooltip="disable all" align="right">
          <TwoStateButton active={allSuppress}
            onClick={() => {
              setConns(conns => {
                const filtered = conns.filter(a => !suggestions.find(b => connEqual(a, b)));
                if (allSuppress) {
                  return filtered;
                }
                else {
                  return [...filtered, ...suggestions.map(sugg => ({...sugg, suppress: true}))];
                }
              });
            }}>
          <BlockIcon fontSize="small"/></TwoStateButton>
          </Tooltip>
        </Toolbar>
      </div>}

      {/* Suggested connections */}
      <Connections
        componentNames={names}
        conns={suggestions}
        startIdx={2}
        actions={(i: number) => {
          const conn = suggestions[i];
          const state = suggestionsState[i];
          return <Toolbar>
            <Tooltip tooltip="enable connection" align="right">
              <TwoStateButton
                  onClick={state === "keep"
                    ? () => setConns(conns => removeConnection(conns, conn))
                    : () => setConns(conns => [...removeConnection(conns, conn), conn])}
                  active={state === "keep"}>
                <CheckIcon fontSize="small"/>
              </TwoStateButton>
            </Tooltip>
            <Tooltip tooltip="disable connection" align="right">
              <TwoStateButton
                  onClick={state === "suppress"
                    ? () => setConns(conns => removeConnection(conns, conn))
                    : () => setConns(conns => [...removeConnection(conns, conn), {...conn, suppress: true}])}
                  active={state === "suppress"}>
                <BlockIcon fontSize="small"/>
              </TwoStateButton>
            </Tooltip>
          </Toolbar>;}}
        rowStyles={suggestionsState.map(state => ({
          backgroundColor: state === "undecided" ? 'var(--warning-bg-color)' : undefined,
        }))}
        cellStyles={suggestionsState.map(state => ({
          textDecoration: state === "suppress" ? 'line-through' : undefined,
        }))}
      />

      {/* Manually added connections */}
      <Connections
        conns={manuallyAdded}
        componentNames={names}
        startIdx={suggestions.length + 2}
        actions={i => {
          return <Toolbar>
            <DoubleClickButton
              tooltip="delete connection"
              align="right"
              onDoubleClick={() => setConns(conns => conns.filter(elem => !connEqual(elem, manuallyAdded[i])))}
            >
              <DeleteOutlineIcon fontSize="small"/>
            </DoubleClickButton>
          </Toolbar>;
        }}
        rowStyles={manuallyAdded.map(() => ({}))}
        cellStyles={manuallyAdded.map(() => ({}))}
      />

      {/* Manually add connection: output event select box */}
      <div style={{gridColumn: 1, gridRow: manuallyAdded.length + suggestions.length + 2}}>
        <select
          className={traceStyles.outputEvent}
          value={selectedOutput}
          onChange={e => {
            setSelectedOutput(e.target.value);
            //setSelectedInput(si => findMatchingEvent(e.target.value, allOutputs, allInputs, si))
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
      {/* Display error when attempting to self-connect */}
      <div style={{gridColumn: 2, gridRow: manuallyAdded.length + suggestions.length + 2, textAlign: 'center'}}>
        {attemptingSelfConnect &&
          <Tooltip tooltip={<>
            Cannot connect component to itself.
            Theory on <a target="_blank" href="https://link.springer.com/content/pdf/10.1007/978-3-030-43946-0_5.pdf">Coupled DEVS</a>, page 136: &quot;A model should not influence itself&quot;.
          </>} showWhen="always" error>
            <span style={{fontWeight: "bold", color: 'var(--error-color)'}}>
            &rarr;
            </span>
          </Tooltip>
          ||
          <>&rarr;</>
        }
      </div>
      {/* Manually add connection: input event select box */}
      <div style={{gridColumn: 3, gridRow: manuallyAdded.length + suggestions.length + 2}}>
        <select
          className={traceStyles.inputEvent}
          value={selectedInput}
          onChange={e => {
            setSelectedInput(e.target.value);
            //setSelectedOutput(si => findMatchingEvent(e.target.value, allInputs, allOutputs, si));
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
      {/* Button to manually add connection */}
      <div style={{gridColumn: 4, gridRow: manuallyAdded.length + suggestions.length + 2}}>
        <Tooltip tooltip="add connection" align="right">
          <Toolbar>
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
          </Toolbar>
        </Tooltip>
      </div>
    </div>
  </>;
}, objectsEqual);

export function autoConnect(allOutputs: (readonly [string, string])[], allInputs: (readonly [string, string])[], alreadyHave: Model2ModelConn[]) {
  return allOutputs.flatMap(([outputModelName, outputEvent]) =>
    allInputs.flatMap(([inputModelName, inputEvent]) =>
      (outputModelName !== inputModelName && outputEvent === inputEvent && !alreadyHave.some(entry => entry.outputModelName === outputModelName && entry.outputEvent === outputEvent && entry.inputModelName === inputModelName && entry.inputEvent === inputEvent)) ? [{
        outputModelName, outputEvent, inputModelName, inputEvent
      }] : []))
}

function connEqual(a: Model2ModelConn, b: Model2ModelConn) {
  return a.inputModelName === b.inputModelName && a.outputModelName === b.outputModelName && a.inputEvent === b.inputEvent && a.outputEvent === b.outputEvent;
}

// function updateConnection(conns: Model2ModelConn[], conn: Model2ModelConn) {
//   const idx = conns.findIndex(elem => connEqual(elem, conn));
//   return conns.toSpliced(idx, 1, conn);
// }

function removeConnection(conns: Model2ModelConn[], conn: Model2ModelConn) {
  return conns.filter(elem => !connEqual(elem, conn));
}
