import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import mqtt, { MqttClient } from "mqtt";

import { makeAllSetters, WithSetters } from "../makePartialSetter";
import { Toolbar } from "../TopPanel/Toolbar";
import { Tooltip } from "../Components/Tooltip";
import { generateRandomHexString } from "@/util/util";

// icons
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { SimulatorStuff } from "../hooks/useSimulator";
import { RaisedEvent } from "@/statecharts/runtime_types";
import { useDisposable } from "../hooks/useDisposable";

export type MQTTState = {
  brokerUrl: string;
  topic: string;
}

export const defaultMQTTState = {
  brokerUrl: "ws://localhost:9001",
  topic: generateRandomHexString(128),
}

type MQTTProps = WithSetters<{
  state: MQTTState;
}> & {
  simulator: SimulatorStuff;
};

const us = generateRandomHexString(128);

export function MQTT({state: {brokerUrl, topic}, setState, simulator}: MQTTProps) {
  const setters = makeAllSetters(setState, Object.keys(defaultMQTTState) as (keyof MQTTState)[]);

  const [connected, setConnected] = useState(false);

  const client = useDisposable(() => {
    let client;
    try {
      client = mqtt.connect(brokerUrl);
    } catch (e) {
      return [null, () => {}];
    }
    client.on("connect", () => {
      setConnected(true);
      console.log('connected to', brokerUrl);
    });
    client.on("error", err => {
      console.error(brokerUrl, err);
    })
    return [
      client,
      // cleanup
      () => {
        setConnected(false);
        client.end();
      },
    ]
  }, [brokerUrl]);

  const fullTopic = `statebuddy/${topic}`;

  // subscribe to our topic
  useEffect(() => {
    if (connected && client) {
      client.subscribe(fullTopic, err => {
        if (err) {
          console.error('subscribe error:', brokerUrl, err);
        }
        else {
          console.log('subscribed to', brokerUrl, fullTopic);
        }
      });
    }
    return () => {
      client?.unsubscribe(fullTopic);
    };
  }, [connected, client, fullTopic]);

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
  }, [connected, client, handler]);

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
        />
      </label>
      {connected ? <>connected</> : <>not connected</>}
    </Toolbar>
    <Toolbar>
      <label style={{flexGrow: 1, display: 'flex'}}>
        topic
        <input
          style={{flexGrow: 1}}
          value={topic}
          onChange={e => setters.setTopic(e.target.value)}
        />
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
  </div>;
}
