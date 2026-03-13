import mqtt, { IClientOptions, MqttClient } from "mqtt";
import { useCallback, useEffect, useState } from "react";

import { RaisedEvent } from "@/statecharts/runtime_types";
import { generateRandomHexString, myPureDeepAssign } from "@/util/util";
import { Tooltip } from "../Components/Tooltip";
import { useDisposable } from "../hooks/useDisposable";
import { SimulatorStuff } from "../hooks/useSimulator";
import { makeAllSetters, WithSetters } from "../makePartialSetter";
import { Toolbar } from "../TopPanel/Toolbar";

// icons
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { usePersistentState } from "@/hooks/usePersistentState";
import { TwoStateButton } from "../Components/TwoStateButton";
import { StatusIndicator, StatusType } from "./Status";

export type MQTTState = {
  on: boolean;
  brokerUrl: string;
  topic: string;
  authentication: boolean;
  user: string;
  password: string;
  seePassword: boolean;
  enableCA: boolean;
  ca: string;

  inputMapping: string;
  outputMapping: string;
}

export const defaultMQTTState: MQTTState = {
  on: false,
  brokerUrl: "ws://localhost:9001",
  topic: generateRandomHexString(128),
  authentication: false,
  user: "",
  password: "",
  seePassword: false,
  enableCA: false,
  ca: "",

  inputMapping: "",
  outputMapping: "",
}

type MQTTProps = WithSetters<{
  state: MQTTState;
}> & {
  simulator: SimulatorStuff;
};

const us = generateRandomHexString(128);

export function MQTT({state, setState, simulator}: MQTTProps) {
  const {on, brokerUrl, topic, authentication, user, password, seePassword, enableCA, ca} = state;
  const setters = makeAllSetters(setState, Object.keys(defaultMQTTState) as (keyof MQTTState)[]);

  const [status, setStatus] = useState<StatusType>("pending");
  const [error, setError] = useState("");

  // for convenience, we store brokers/topics that we successfully connected/subscribed to in the past in localStorage 
  const [knownBrokers, setKnownBrokers] = usePersistentState<string[]>("known-brokers", []);
  const [knownTopics, setKnownTopics] = usePersistentState<string[]>("known-topics", []);

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

  const fullTopic = `${topic}`;

  // subscribe to our topic
  useEffect(() => {
    if (status === "ok" && client) {
      client.subscribe(fullTopic, err => {
        if (err) {
          console.error('subscribe error:', brokerUrl, err);
        }
        else {
          console.log('subscribed to', brokerUrl, fullTopic);
          setKnownTopics(known => [topic, ...known.filter(t => t !== topic)]);
        }
      });
    }
    return () => {
      client?.unsubscribe(fullTopic);
    };
  }, [status, client, fullTopic]);

  const handler = useCallback((topic: string, message: Buffer) => {
    console.log('received', topic);
    if (topic === fullTopic) {
      try {
        const {sender, bagOfEvents} = JSON.parse(message.toString());
        console.log('decoded:', {sender, bagOfEvents});
        if (sender !== us) {
          simulator.simulatorCallbacks.onRaise(bagOfEvents);
        }
      } catch (e) {
        console.warn('failed to parse incoming MQTT message as event', message);
      }
    }
  }, [simulator.simulatorCallbacks.onRaise]);

  // listen for MQTT-incoming events and feed them to our simulation
  useEffect(() => {
    client?.on("message", handler);
    return () => {
      client?.off("message", handler);
    };
  }, [status, client, handler]);

  const outEventListener = useCallback((bagOfEvents: RaisedEvent[]) => {
    const message = JSON.stringify({sender: us, bagOfEvents});
    if (client) {
      console.log('publishing message', brokerUrl, fullTopic);
      client.publish(fullTopic, message);
    }
    else {
      console.log('not sending message (no client)');
    }
  }, [client, fullTopic]);

  // listen for simulation output events and publish them with MQTT
  useEffect(() => {
    simulator.simulatorCallbacks.addOutputListener(outEventListener);
    return () => {
      simulator.simulatorCallbacks.rmOutputListener(outEventListener);
    };
  }, [outEventListener]);

  const newRandomTopic = useCallback(() => {
    setters.setTopic(generateRandomHexString(128));
  }, [setters.setTopic]);

  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(state, null, 2))
      .then(() => setCopied(true));
  }, [state]);

  const onImport = useCallback(() => {
    navigator.clipboard.readText().then((text) => {
      try {
        const newState = JSON.parse(text);
        console.log(newState);
        setState(state => 
          myPureDeepAssign(
            state,
            myPureDeepAssign(newState, {}), // <-- ensure we're dealing with an object
          ));
      }
      catch (e) {
        console.warn("error pasting MQTT config from clipboard", e);
      }
    });
  }, [])

  return <div>
    <Toolbar>
      <label>
        connect to MQTT
        <input type="checkbox" checked={on} onChange={e => setters.setOn(e.target.checked)} />
      </label>
      <div style={{flexGrow: 1}}/>
      <Toolbar>
        <Tooltip
          tooltip={copied ? "copied!" : "copy MQTT configuration"}
          showWhen={copied ? "always" : "hover"}
          align="right" >
          <button onClick={onCopy} onMouseLeave={() => setCopied(false)}>
            <ContentCopyIcon fontSize="small"/>
            copy
          </button>
        </Tooltip>
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
      <Tooltip align="right" tooltip={{
        "ok": "connected",
        "nok": error,
        "pending": "not connected",
      }[status]}>
        <StatusIndicator status={status}/>
      </Tooltip>
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
        style={{fontFamily: 'Roboto', flexGrow: 1, height: 60, boxSizing: 'border-box', border: '1px solid var(--separator-color)'}}
        placeholder="paste CA cert here"
        value={ca}
        disabled={!enableCA}
        onChange={e => setters.setCa(e.target.value)}
      />}
    </Toolbar>
    <Toolbar>
      <label style={{flexGrow: 1, display: 'flex'}}>
        topic
        <input
          style={{flexGrow: 1}}
          value={topic}
          onChange={e => setters.setTopic(e.target.value)}
          list="known-topics"
        />
        <datalist id="known-topics">
          {knownTopics.map(topic => <option key={topic} value={topic}/>)}
        </datalist>
      </label>
      <Tooltip tooltip="generate random topic" align="right">
        <button onClick={newRandomTopic}>
          <RefreshIcon fontSize="small"/>
        </button>
      </Tooltip>
    </Toolbar>
  </div>;
}
