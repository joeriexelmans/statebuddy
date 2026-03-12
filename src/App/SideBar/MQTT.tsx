import mqtt, { MqttClient } from "mqtt";
import { useCallback, useEffect, useState } from "react";

import { RaisedEvent } from "@/statecharts/runtime_types";
import { generateRandomHexString } from "@/util/util";
import { Tooltip } from "../Components/Tooltip";
import { useDisposable } from "../hooks/useDisposable";
import { SimulatorStuff } from "../hooks/useSimulator";
import { makeAllSetters, WithSetters } from "../makePartialSetter";
import { Toolbar } from "../TopPanel/Toolbar";

// icons
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { usePersistentState } from "@/hooks/usePersistentState";
import { TwoStateButton } from "../Components/TwoStateButton";
import { StatusIndicator, StatusType } from "./Status";

export type MQTTState = {
  brokerUrl: string;
  topic: string;
  authentication: boolean;
  user: string;
  password: string;
  seePassword: boolean;
  enableCA: boolean;
  ca: string;
}

export const defaultMQTTState: MQTTState = {
  brokerUrl: "ws://localhost:9001",
  topic: generateRandomHexString(128),
  authentication: false,
  user: "",
  password: "",
  seePassword: false,
  enableCA: false,
  ca: "",
}

type MQTTProps = WithSetters<{
  state: MQTTState;
}> & {
  simulator: SimulatorStuff;
};

const us = generateRandomHexString(128);

export function MQTT({state: {brokerUrl, topic, authentication, user, password, seePassword, enableCA, ca}, setState, simulator}: MQTTProps) {
  const setters = makeAllSetters(setState, Object.keys(defaultMQTTState) as (keyof MQTTState)[]);

  const [status, setStatus] = useState<StatusType>("pending");

  // for convenience, we store brokers/topics that we successfully connected/subscribed to in the past in localStorage 
  const [knownBrokers, setKnownBrokers] = usePersistentState<string[]>("known-brokers", []);
  const [knownTopics, setKnownTopics] = usePersistentState<string[]>("known-topics", []);

  const client = useDisposable<MqttClient>(setClient => {
    let client: MqttClient;
    const errHandler = (err: any) => {
      console.error(brokerUrl, err);
      setStatus("nok");
    };
    const timeout = setTimeout(() => {
      try {
        client = mqtt.connect(brokerUrl, {
          username: authentication ? user : undefined,
          password: authentication ? password : undefined,
          ca: enableCA ? ca : undefined,
        });
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
    }, 200);
    return () => {
      clearTimeout(timeout);
      setStatus("pending");
      if (client) {
        client.off("error", errHandler); // <-- not interested in errors after disconnect
        client.end();
      }
    };
  }, [brokerUrl, authentication, user, password, enableCA, ca]);

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
    console.log('received', topic, message);
    if (topic === fullTopic) {
      const {sender, bagOfEvents} = JSON.parse(message.toString());
      if (sender !== us) {
        simulator.simulatorCallbacks.onRaise(bagOfEvents);
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

  const onCopyTopic = useCallback(() => {
    navigator.clipboard.writeText(topic)
      .then(() => setCopied(true));
  }, []);

  return <div>
    <Toolbar>
      <label style={{flexGrow: 1, display: 'flex'}}>
        broker URL
        <input
          style={{flexGrow: 1}}
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
        "nok": "connection error",
        "pending": "pending",
      }[status]}>
        <StatusIndicator status={status}/>
      </Tooltip>
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
      <Tooltip
        tooltip={copied ? "copied!" : "copy topic"}
        showWhen={copied ? "always" : "hover"}
        align="right" >
        <button onClick={onCopyTopic} onMouseLeave={() => setCopied(false)}>
          <ContentCopyIcon fontSize="small"/>
        </button>
      </Tooltip>
    </Toolbar>
    <Toolbar>
      <Tooltip tooltip="enable/disable authentication with broker" align="left">
        <label>
          auth
          <input type="checkbox" checked={authentication} onChange={e => setters.setAuthentication(e.target.checked)} />
        </label>
      </Tooltip>
      <input style={{flexGrow: 1}} placeholder="user" value={user} disabled={!authentication} onChange={e => setters.setUser(e.target.value)}/>
      <Toolbar style={{flexGrow: 1}}>
        <input style={{flexGrow: 1}} type={seePassword ? "text" : "password"} placeholder="password" value={password} disabled={!authentication} onChange={e => setters.setPassword(e.target.value)}/>
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
      <textarea
        style={{fontFamily: 'Roboto', flexGrow: 1, height: 60, boxSizing: 'border-box', border: '1px solid var(--separator-color)'}}
        value={ca}
        disabled={!enableCA}
        onChange={e => setters.setCa(e.target.value)}
      />
    </Toolbar>
  </div>;
}
