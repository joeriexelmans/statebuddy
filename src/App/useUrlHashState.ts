import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { BigStepCause, EditHistory } from "./App";
import { VisualEditorState } from "./VisualEditor/VisualEditor";
import { emptyState } from "@/statecharts/concrete_syntax";
import { InsertMode } from "./TopPanel/InsertModes";
import { Conns } from "@/statecharts/timed_reactive";

export function useUrlHashState(editorState: VisualEditorState | null, setEditHistory: Dispatch<SetStateAction<EditHistory|null>>) {

  // i should probably put all these things into a single object, the 'app state'...
  const [autoScroll, setAutoScroll] = useState(false);
  const [autoConnect, setAutoConnect] = useState(true);
  const [plantConns, setPlantConns] = useState<Conns>({});
  const [showKeys, setShowKeys] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [insertMode, setInsertMode] = useState<InsertMode>("and");
  const [plantName, setPlantName] = useState("dummy");

  const [showConnections, setShowConnections] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showExecutionTrace, setShowExecutionTrace] = useState(true);
  const [showPlantTrace, setShowPlantTrace] = useState(false);
  const [properties, setProperties] = useState<string[]>([]);
  const [savedTraces, setSavedTraces] = useState<[string, BigStepCause[]][]>([]);
  const [activeProperty, setActiveProperty] = useState<number>(0);


  // recover editor state from URL - we need an effect here because decompression is asynchronous
  useEffect(() => {
    console.log('recovering state...');
    const compressedState = window.location.hash.slice(1);
    if (compressedState.length === 0) {
      // empty URL hash
      console.log("no state to recover");
      setEditHistory(() => ({current: emptyState, history: [], future: []}));
      return;
    }
    let compressedBuffer;
    try {
      compressedBuffer = Uint8Array.fromBase64(compressedState); // may throw
    } catch (e) {
      // probably invalid base64
      console.error("failed to recover state:", e);
      setEditHistory(() => ({current: emptyState, history: [], future: []}));
      return;
    }
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(compressedBuffer).catch(() => {}); // any promise rejections will be detected when we try to read
    writer.close().catch(() => {});
    new Response(ds.readable).arrayBuffer()
      .then(decompressedBuffer => {
        const recoveredState = JSON.parse(new TextDecoder().decode(decompressedBuffer));
        // we support two formats
        if (recoveredState.nextID) {
          // old format
          setEditHistory(() => ({current: recoveredState, history: [], future: []}));
        }
        else {
          console.log(recoveredState);
          // new format
          if (recoveredState.editorState !== undefined) {
            setEditHistory(() => ({current: recoveredState.editorState, history: [], future: []}));
          }
          if (recoveredState.plantName !== undefined) {
            setPlantName(recoveredState.plantName);
          }
          if (recoveredState.autoScroll !== undefined) {
            setAutoScroll(recoveredState.autoScroll);
          }
          if (recoveredState.autoConnect !== undefined) {
            setAutoConnect(recoveredState.autoConnect);
          }
          if (recoveredState.plantConns !== undefined) {
            setPlantConns(recoveredState.plantConns);
          }
          
          if (recoveredState.showKeys !== undefined) {
            setShowKeys(recoveredState.showKeys);
          }
          if (recoveredState.zoom !== undefined) {
            setZoom(recoveredState.zoom);
          }
          if (recoveredState.insertMode !== undefined) {
            setInsertMode(recoveredState.insertMode);
          }
          if (recoveredState.showConnections !== undefined) {
            setShowConnections(recoveredState.showConnections);
          }
          if (recoveredState.showProperties !== undefined) {
            setShowProperties(recoveredState.showProperties);
          }
          if (recoveredState.showExecutionTrace !== undefined) {
            setShowExecutionTrace(recoveredState.showExecutionTrace);
          }
          if (recoveredState.showPlantTrace !== undefined) {
            setShowPlantTrace(recoveredState.showPlantTrace);
          }
          if (recoveredState.properties !== undefined) {
            setProperties(recoveredState.properties);
          }
          if (recoveredState.savedTraces !== undefined) {
            setSavedTraces(recoveredState.savedTraces);
          }
          if (recoveredState.activeProperty !== undefined) {
            setActiveProperty(recoveredState.activeProperty);
          }
          
        }
      })
      .catch(e => {
        // any other error: invalid JSON, or decompression failed.
        console.error("failed to recover state:", e);
        setEditHistory({current: emptyState, history: [], future: []});
      });
  }, []);

  // save editor state in URL
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (editorState === null) {
        window.location.hash = "#";
        return;
      }
      const serializedState = JSON.stringify({
        autoConnect,
        autoScroll,
        plantConns,
        showKeys,
        zoom,
        insertMode,
        plantName,
        editorState,
        showConnections,
        showProperties,
        showExecutionTrace,
        showPlantTrace,
        properties,
        savedTraces,
        activeProperty,
      });
      const stateBuffer = new TextEncoder().encode(serializedState);
      const cs = new CompressionStream("deflate");
      const writer = cs.writable.getWriter();
      writer.write(stateBuffer);
      writer.close();
      // todo: cancel this promise handler when concurrently starting another compression job
      new Response(cs.readable).arrayBuffer().then(compressedStateBuffer => {
        const compressedStateString = new Uint8Array(compressedStateBuffer).toBase64();
        window.location.hash = "#"+compressedStateString;
      });
    }, 100);
    return () => clearTimeout(timeout);
  }, [
    editorState,

    autoConnect,
    autoScroll,
    plantConns,
    showKeys,
    zoom,
    insertMode,
    plantName,
    showConnections,
    showProperties,
    showExecutionTrace,
    showPlantTrace,
    properties,
    savedTraces,
    activeProperty,
  ]);

  return {
    autoConnect,
    setAutoConnect,
    autoScroll,
    setAutoScroll,
    plantConns,
    setPlantConns,
    showKeys,
    setShowKeys,
    zoom,
    setZoom,
    insertMode,
    setInsertMode,
    plantName,
    setPlantName,
    showConnections,
    setShowConnections,
    showProperties,
    setShowProperties,
    showExecutionTrace,
    setShowExecutionTrace,
    showPlantTrace,
    setShowPlantTrace,
    properties,
    setProperties,
    savedTraces,
    setSavedTraces,
    activeProperty,
    setActiveProperty,
  }
}