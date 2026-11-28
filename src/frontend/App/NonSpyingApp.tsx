import { useState } from "react";
import { AppState } from "./App.state";
import { PersistentApp } from "./PersistentApp";

export function NonSpyingApp() {
  const [appState, setAppState] = useState<AppState|undefined>(undefined);
  return <PersistentApp {...{appState, setAppState}}/>;
}
