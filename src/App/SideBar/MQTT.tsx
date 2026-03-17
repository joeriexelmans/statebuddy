import mqtt, { IClientOptions, MqttClient } from "mqtt";
import { useCallback, useEffect, useState } from "react";

// icons
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import JavascriptIcon from '@mui/icons-material/Javascript';

import { RaisedEvent } from "@/statecharts/runtime_types";
import { generateRandomHexString, myPureDeepAssign } from "@/util/util";
import { Tooltip } from "../Components/Tooltip";
import { useDisposable } from "../hooks/useDisposable";
import { SimulatorStuff } from "../hooks/useSimulator";
import { makeAllSetters, makePartialArraySetter, makePartialSetter, WithSetters } from "../makePartialSetter";
import { Toolbar } from "../TopPanel/Toolbar";
import { useLocalStorage } from "@/hooks/usePersistentState";
import { TwoStateButton } from "../Components/TwoStateButton";
import { DoubleClickButton } from "../Components/DoubleClickButton";
import { ClickToCopy } from "../Components/ClickToCopy";
import { useKicker } from "@/hooks/useKicker";
import { StatusType, StatusIndicator, FlickeringStatusIndicator } from "../Components/StatusIndicator";
import { Statechart } from "@/statecharts/abstract_syntax";
import { EventTrigger } from "@/statecharts/label_ast";
import traceStyles from "./Trace.module.css";

export type MQTTState = {
  on: boolean;
  brokerUrl: string;
  authentication: boolean;
  user: string;
  password: string;
  seePassword: boolean;
  enableCA: boolean;
  ca: string;
  baseTopic: string;
  topics: TopicConfig[];
}

type TopicConfig = {
  // prefix to the topic
  prefix: string;

  // mapping MQTT subscriptions -> input events
  inputMappings: Event2MQTTMapping[];

  // mapping output events -> MQTT publications
  outputMappings:  Event2MQTTMapping[];
};

type Event2MQTTMapping = {
  eventName:   string; // e.g., doneHoist
  requestName: string; // e.g., hoist
  payload:     string; // e.g., "({height}) => height"
};

const defaultTopic: TopicConfig = {
  prefix: "",
  inputMappings: [],
  outputMappings: [],
}

const defaultMapping: Event2MQTTMapping = {
  eventName: "",
  requestName: "",
  payload: "",
}

export const defaultMQTTState: MQTTState = {
  on: false,
  brokerUrl: "ws://localhost:9001",
  authentication: false,
  user: "",
  password: "",
  seePassword: false,
  enableCA: false,
  ca: "",
  baseTopic: "",
  topics: [],
}

type MQTTProps = WithSetters<{
  state: MQTTState; // <-- the user-configurable MQTT setup
}> & {
  simulator: SimulatorStuff;  // <-- needed for subscribing to output events and raising input events
  abstractSyntax: Statechart; // <-- needed for list of in/out events
};

// const us = generateRandomHexString(128);

const flickerDuration = 60; // ms

export function MQTT({state, setState, simulator, abstractSyntax}: MQTTProps) {
  const {on, brokerUrl, topics, baseTopic, authentication, user, password, seePassword, enableCA, ca} = state;
  const setters = makeAllSetters(setState, Object.keys(defaultMQTTState) as (keyof MQTTState)[]);

  const [status, setStatus] = useState<StatusType>("pending");
  const [error, setError] = useState("");

  // for convenience, we store brokers/topics that we successfully connected/subscribed to in the past in localStorage 
  const [knownBrokers, setKnownBrokers] = useLocalStorage<string[]>("known-brokers", []);
  // const [knownTopics, setKnownTopics] = usePersistentState<string[]>("known-topics", []);

  // Connect to MQTT...
  const client = useDisposable<MqttClient>(setClient => {
    const clientId = `statebuddy-${generateRandomHexString(32)}`;
    let client: MqttClient;
    const errHandler = (err: any) => {
      console.error(brokerUrl, err);
      setStatus("nok");
      setError(`${err.message}\n\nURL: ${brokerUrl}\n\n${user}\n${password}\n\nClient ID: ${clientId}`);
    };
    const timeout = setTimeout(() => {
      if (on) {
        try {
          const options: IClientOptions = {
            username: authentication ? user : undefined,
            password: authentication ? password : undefined,
            ca: enableCA ? ca : undefined,
            reconnectPeriod: 5000,
            clientId,
          };
          console.log('connecting', JSON.stringify(options));
          client = mqtt.connect(brokerUrl, options);
        } catch (e) {
          return () => {};
        }
        client.on("connect", () => {
          setStatus("ok");
          console.log('connected to', brokerUrl);
          setKnownBrokers(known => [brokerUrl, ...known.filter(u => u !== brokerUrl)]);
        });
        client.on("error", errHandler);
        setClient(client);
      }
    }, 200);
    return () => {
      clearTimeout(timeout);
      setStatus("pending");
      if (client) {
        client.off("error", errHandler); // <-- not interested in errors after disconnect
        client.end();
      }
    };
  }, [on, brokerUrl, authentication, user, password, enableCA, ca]);

  // MQTT message handler feeds received messages into our simulation
  const handler = useCallback((recvTopic: string, message: Buffer) => {
    console.log('received', recvTopic);
    for (const topic of topics) {
      const fullPrefix = baseTopic + topic.prefix;
      for (const im of topic.inputMappings) {
        const fullTopic = fullPrefix + im.requestName;
        console.log({fullTopic, recvTopic});
        if (fullTopic === recvTopic) {
          console.log('will handle message...');
          const fn = new Function(`return ${im.payload}`)();
          try {
            const json = JSON.parse(message.toString());
            const param = fn(json);
            console.log('message parse successful. raising event...')
            simulator.simulatorCallbacks.onRaise([{
              name: im.eventName,
              param,
            }]);
          } catch (e) {
            console.warn('failed to handle incoming message', e);
          }
        }
      }
    }
  }, [simulator.simulatorCallbacks.onRaise, topics]);

  // Register our MQTT message handler
  useEffect(() => {
    client?.on("message", handler);
    return () => {
      client?.off("message", handler);
    };
  }, [status, client, handler]);

  const onImport = useCallback(() => {
    navigator.clipboard.readText().then((text) => {
      try {
        const newState = JSON.parse(text);
        console.log('pasted data:', newState);
        setState(oldState => {
          const mergedState = myPureDeepAssign(
            oldState,
            myPureDeepAssign(newState, {}), // <-- ensure we're dealing with an object
          );
          console.log('merged state:', mergedState);
          return mergedState;
        });
      }
      catch (e) {
        console.warn("error pasting MQTT config from clipboard", e);
      }
    });
  }, []);

  return <div>
    <Toolbar>
      <label>
        connect to MQTT
        <input type="checkbox" checked={on} onChange={e => setters.setOn(e.target.checked)} />
      </label>
      <div style={{flexGrow: 1}}/>
      <Toolbar>
        <ClickToCopy
          textToCopy={JSON.stringify(state, null, 2)}
          tooltip={"copy MQTT configuration"}
          align="right"
        >
          <button>
            <ContentCopyIcon fontSize="small"/>
            copy
          </button>
        </ClickToCopy>
        <Tooltip
          tooltip={"import MQTT configuration from clipboard"}
          align="right" >
          <button onClick={onImport}>
            <ContentPasteIcon fontSize="small"/>
            paste
          </button>
        </Tooltip>
      </Toolbar>

    </Toolbar>
    <Toolbar>
      <Tooltip align="left" tooltip={{
        "ok": "connected to broker",
        "nok": error,
        "pending": "not connected to broker",
      }[status]}>
        <StatusIndicator status={status}/>
      </Tooltip>
      <label style={{flexGrow: 1, display: 'flex'}}>
        <input
          placeholder="broker URL"
          style={{flexGrow: 1, width: 40}}
          value={brokerUrl}
          onChange={e => setters.setBrokerUrl(e.target.value)}
          list="known-brokers"
        />
        <datalist id="known-brokers">
          {knownBrokers.map(brokerUrl => <option key={brokerUrl} value={brokerUrl}/>)}
        </datalist>
      </label>
    </Toolbar>
    <Toolbar>
      <Tooltip tooltip="enable/disable authentication with broker" align="left">
        <label>
          auth
          <input type="checkbox" checked={authentication} onChange={e => setters.setAuthentication(e.target.checked)} />
        </label>
      </Tooltip>
      <input style={{flexGrow: 1, width: 40}} placeholder="username" value={user} disabled={!authentication} onChange={e => setters.setUser(e.target.value)}/>
      <Toolbar style={{flexGrow: 1}}>
        <input style={{flexGrow: 1, width: 40}} type={seePassword ? "text" : "password"} placeholder="password" value={password} disabled={!authentication} onChange={e => setters.setPassword(e.target.value)}/>
        <Tooltip tooltip="see password" align="right">
          <TwoStateButton active={seePassword} onClick={() => setters.setSeePassword(p => !p)}>
            <VisibilityIcon fontSize="small"/>
          </TwoStateButton>
        </Tooltip>
      </Toolbar>
    </Toolbar>
    <Toolbar>
      <label>
        CA cert
        <input type="checkbox" checked={enableCA} onChange={e => setters.setEnableCA(e.target.checked)} />
      </label>
      {enableCA && <textarea
        style={{
          fontFamily: "'Droid Sans Mono', monospace",
          fontSize: '10pt',
          flexGrow: 1,
          height: 60,
          boxSizing: 'border-box',
          border: '1px solid var(--separator-color)',
        }}
        placeholder="paste CA cert here"
        value={ca}
        disabled={!enableCA}
        onChange={e => setters.setCa(e.target.value)}
      />}
    </Toolbar>

    <Toolbar>
      <label style={{flexGrow: 1, display: 'flex'}}>
        global prefix
        <input
          style={{flexGrow: 1}}
          value={baseTopic}
          onChange={e => setters.setBaseTopic(e.target.value)}
        />
      </label>
    </Toolbar>

    {topics.map((t, i) =>
      <TopicView
        key={i}
        topic={t}
        setTopic={makePartialArraySetter(setters.setTopics, i)}
        client={client}
        clientStatus={status}
        baseTopic={baseTopic}
        onDelete={() => setters.setTopics(ts => ts.toSpliced(i, 1))}
        simulator={simulator}
        abstractSyntax={abstractSyntax}
      />)}

    <button onClick={() => setters.setTopics(ts => [...ts, defaultTopic])}>
      <AddIcon fontSize="small"/> add topic
    </button>
  </div>;
}

function TopicSubscriptionView({fullTopic, client, clientStatus}: {fullTopic: string, client: MqttClient|null, clientStatus: StatusType}) {
  const [status, setStatus] = useState<StatusType>("pending");
  const [error, setError] = useState("");
  const [kicked, kick] = useKicker(flickerDuration);

  // subscribe to a topic
  useEffect(() => {
    if (client && clientStatus === "ok") {
      client.subscribe(fullTopic, err => {
        if (err) {
          console.error('subscribe error:', err);
          setStatus("nok");
          setError(err.message);
        }
        else {
          console.log('subscribed to', fullTopic);
          setStatus("ok");
        }
      });
      client.on("message", (topic) => {
        if (topic === fullTopic) {
          kick();
        }
      });
    }
    else {
      setStatus("pending");
    }
    return () => {
      setStatus("pending");
      client?.unsubscribe(fullTopic);
    };
  }, [client, clientStatus, fullTopic]);

  return <ClickToCopy
    textToCopy={fullTopic}
    tooltip={{
      "pending": "not subscribed\n" + fullTopic + "\nclick to copy full topic",
      "ok": "subscribed\n" + fullTopic + "\nclick to copy full topic",
      "nok": error + "\n" + fullTopic + "\nclick to copy full topic",
    }[status]}
    align="left"
  >
    <FlickeringStatusIndicator big={kicked} status={status}/>
  </ClickToCopy>;
}

function ScOutEventSubscriptionView({simulator, fullTopic, client, clientStatus, om}: {simulator: SimulatorStuff, fullTopic: string, client: MqttClient|null, clientStatus: StatusType, om: Event2MQTTMapping}) {
  const [kicked, kick] = useKicker(flickerDuration);

  // Statechart output event listener publishes MQTT messages
  const outEventListener = useCallback((bagOfEvents: RaisedEvent[]) => {
    if (client && clientStatus === "ok") {
      for (const event of bagOfEvents) {
        if (om.eventName === event.name) {
          const fn = new Function(`return ${om.payload}`)();
          const payload = JSON.stringify(fn(event.param));
          console.log('publishing message\n', fullTopic, '\n', payload);
          client.publish(fullTopic, payload);
          kick();
        }
      }
    }
  }, [client, clientStatus, fullTopic, om]);

  useEffect(() => {
    simulator.simulatorCallbacks.addOutputListener(outEventListener);
    return () => {
      simulator.simulatorCallbacks.rmOutputListener(outEventListener);
    };
  }, [outEventListener]);

  return <ClickToCopy
    textToCopy={fullTopic}
    tooltip={"publishing to\n" + fullTopic + "\nclick to copy topic"}
    align="right"
  >
    <FlickeringStatusIndicator big={kicked} status={clientStatus}/>
  </ClickToCopy>;
}

function TopicView({topic, setTopic, client, clientStatus, baseTopic, onDelete, simulator, abstractSyntax}: WithSetters<{topic: TopicConfig}> & {client: MqttClient|null, clientStatus: StatusType, baseTopic: string, onDelete: () => void, simulator: SimulatorStuff, abstractSyntax: Statechart}) {
  const setters = makeAllSetters(setTopic, Object.keys(defaultTopic) as (keyof TopicConfig)[]);
  const fullPrefix = baseTopic+topic.prefix;

  return <fieldset>
    <legend style={{flexGrow: 1, display: 'flex'}}>
      <label style={{flexGrow: 1, display: 'flex'}}>
        <input
          style={{flexGrow: 1}}
          value={topic.prefix}
          placeholder="topic prefix"
          onChange={e => setTopic(t => ({...t, prefix: e.target.value}))}
        />
      </label>
      <DoubleClickButton tooltip="delete topic" align="right" onDoubleClick={onDelete}>
        <DeleteOutlineIcon fontSize="small"/>
      </DoubleClickButton>
    </legend>
    <fieldset style={{border: 0, display: 'flex', flexDirection: 'column'}}>
      <legend>
        input mappings
      </legend>
      {topic.inputMappings.map((m, i) => {
        const setMapping = makePartialArraySetter(setters.setInputMappings, i);
        return <Toolbar style={{flexGrow: 1, flexWrap: 'wrap', alignItems: 'start', columnGap: 10}}>
          <Toolbar style={{flexGrow: 1}}>
            <TopicSubscriptionView
              client={client}
              clientStatus={clientStatus}
              fullTopic={fullPrefix + m.requestName}
            />
            <InputMapping
              mapping={m}
              setMapping={setMapping}
              events={abstractSyntax.inputEvents}
            />
          </Toolbar>
          <Toolbar style={{alignItems: 'start', flexGrow: 1}}>
            <Payload
              placeholder="MQTT-payload => in-event param"
              payload={m.payload}
              setPayload={makePartialSetter(setMapping, 'payload')}
            />
            <DoubleClickButton
              tooltip="delete mapping"
              align="right"
              onDoubleClick={() => setters.setInputMappings((m) => m.toSpliced(i, 1))}
            >
              <DeleteOutlineIcon fontSize="small"/>
            </DoubleClickButton>
          </Toolbar>
        </Toolbar>;
      })}
      <button
        onClick={() => setters.setInputMappings((m) => [...m, defaultMapping])}
        style={{flexGrow: 1}}>
        <AddIcon fontSize="small"/>
        add input mapping
      </button>
    </fieldset>
    <fieldset style={{border: 0, display: 'flex', flexDirection: 'column'}}>
      <legend>
        output mappings
      </legend>
      {topic.outputMappings.map((m, i) => {
        const fullTopic = fullPrefix + m.requestName;
        const setMapping = makePartialArraySetter(setters.setOutputMappings, i);
        return <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'start', columnGap: 10}}>
          <Toolbar style={{flexGrow: 1}}>
            <OutputMapping
              mapping={m}
              setMapping={setMapping}
              events={[...abstractSyntax.outputEvents].map(e => ({event: e, kind: "event"}))}
            />
            <ScOutEventSubscriptionView
              client={client}
              clientStatus={clientStatus}
              fullTopic={fullTopic}
              om={m}
              simulator={simulator}
            />
            {/* <FlickeringStatusIndicator status="ok" big={kicked}/> */}
          </Toolbar>
          <Toolbar style={{alignItems: 'start', flexGrow: 1}}>
            {/* <JavascriptIcon fontSize="small"/> */}
            <Payload
              placeholder="out-event param -> MQTT payload"
              payload={m.payload}
              setPayload={makePartialSetter(setMapping, 'payload')}
            />
            <DoubleClickButton
              tooltip="delete mapping"
              align="right"
              onDoubleClick={() => setters.setOutputMappings((m) => m.toSpliced(i, 1))}
            >
              <DeleteOutlineIcon fontSize="small"/>
            </DoubleClickButton>
          </Toolbar>
        </div>;
      })}
      <button
        onClick={() => setters.setOutputMappings((m) => [...m, defaultMapping])}
        style={{flexGrow: 1}}>
        <AddIcon fontSize="small"/>
        add output mapping
      </button>
    </fieldset>
  </fieldset>;
}

function InputMapping({mapping, setMapping, events}: WithSetters<{mapping: Event2MQTTMapping}> & {events: EventTrigger[]}) {
  return <Toolbar style={{flex: '1 1 60px', gap: 6}}>
    <input
      style={{flex: '1 1 60px', width: 60}}
      placeholder="topic suffix"
      value={mapping.requestName}
      onChange={(e) => setMapping(m => ({...m, requestName: e.target.value}))}
    />
    →
    {/* <input
      style={{flex: '1 1 60px', width: 60}}
      placeholder="event"
      value={mapping.eventName}
      onChange={(e) => setMapping(m => ({...m, eventName: e.target.value}))}
    /> */}
    <select
      className={traceStyles.inputEvent}
      style={{flex: '1 1 60px', width: 60}}
      value={mapping.eventName}
      onChange={(e) => setMapping(m => ({...m, eventName: e.target.value}))}
    >
      <option value=""></option>
      {events.map(e => <option key={e.event }value={e.event}>↘{e.event}</option>)}
    </select>
  </Toolbar>;
}

function OutputMapping({mapping, setMapping, events}: WithSetters<{mapping: Event2MQTTMapping}> & {events: EventTrigger[]}) {
  return <Toolbar style={{flex: '1 1 60px', gap: 6}}>
    <select
      className={traceStyles.outputEvent}
      style={{flex: '1 1 60px', width: 60}}
      value={mapping.eventName}
      onChange={(e) => setMapping(m => ({...m, eventName: e.target.value}))}
    >
      <option value=""></option>
      {events.map(e => <option key={e.event} value={e.event}>↗{e.event}</option>)}
    </select>
    {/* <input
      style={{flex: '1 1 60px', width: 60}}
      placeholder="output event"
      value={mapping.eventName}
      onChange={(e) => setMapping(m => ({...m, eventName: e.target.value}))}
    /> */}
    →
    <input
      style={{flex: '1 1 60px', width: 60}}
      placeholder="topic suffix"
      value={mapping.requestName}
      onChange={(e) => setMapping(m => ({...m, requestName: e.target.value}))}
    />
  </Toolbar>;
}

function Payload({payload, setPayload, placeholder}: WithSetters<{payload: string}> & {placeholder: string}) {
  return <textarea
    style={{
      flexGrow: 1,
      fontFamily: "'Droid Sans Mono', monospace",
      fontSize: '10pt',
      resize: 'vertical',
      height: (payload.split('\n').length*1.5) + 0.5 + 'em',
    }}
    placeholder={placeholder}
    value={payload}
    onChange={(e) => setPayload(e.target.value)}
  />;
}