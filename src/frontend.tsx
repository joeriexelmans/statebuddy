/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App/App";
import { ErrorBoundary } from "react-error-boundary";
import { ModalOverlay } from "./App/Overlays/ModalOverlay";
import deadStatebuddy from "../artwork/new-logo/dead-statebuddy-optimized.svg";
import { Tooltip } from "./App/Components/Tooltip";

const elem = document.getElementById("root")!;
const app = (
  // I disabled strict mode because the double rendering is annoying to debug.


  // <StrictMode>
  <ErrorBoundary fallback={
    // I'm (ab)using ModalOverlay here to render something centered on the page.
    <ModalOverlay
      modal={<div>
        <style>{`
          h1 + h3 { visibility: hidden; }
          h1:hover + h3, h3:hover { visibility: visible; }
        `}</style>
        <img src={deadStatebuddy} width="100%" />
        <h1>StateBuddy crashed! :(</h1>
        <h3>... and went to <a href="https://static1.squarespace.com/static/50e08e65e4b0c2f4976972df/t/588a2e70725e25b6981e64d1/1485450864394/Chiang+Hell+Is+the+Absence+of+God.pdf">heaven</a>.</h3>
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
