![logo](./artwork/new-logo/new-logo-playful-minified.svg)

![screenshot](./docs/screenshot.png)

Statechart design, simulation and testing tool, developed with the goal of teaching Statecharts, but probably useful in its own right.

Live version available here:
[https://deemz.org/public/statebuddy](https://deemz.org/public/statebuddy)

### Features

  - intuitive editor
      - ![](./docs/editing.webp) ![](./docs/editing2.webp)
  - simulation
      - step-by-step
      - (scaled) real-time
  - omniscient debugging (= ability to undo execution steps)
  - ability to save / restore execution traces
  - metric temporal logic (MTL) property checking on saved traces
  - no need to install anything, runs entirely locally(*) in browser

(*) except for MTL property checking, which depends on an external REST service endpoint.