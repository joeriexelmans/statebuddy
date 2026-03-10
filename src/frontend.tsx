/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App/App";
import { ErrorBoundary } from "react-error-boundary";
import { ModalOverlay } from "./App/Overlays/ModalOverlay";
import deadStatebuddy from "../artwork/new-logo/dead-statebuddy-optimized.svg";

const elem = document.getElementById("root")!;
const app = (
  // I disabled strict mode because the double rendering is annoying to debug.

  // <StrictMode>
  <ErrorBoundary fallback={
    // I'm (ab)using ModalOverlay here to render something centered on the page.
    <ModalOverlay
      modal={<div style={{width: 300}}>
        <img src={deadStatebuddy} width="100%" />
        <h1>StateBuddy crashed! :(</h1>
      </div>}
      setModal={() => {}}>
    </ModalOverlay>
  }>
    <App />
  </ErrorBoundary>
  // </StrictMode>
);

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app);
}
