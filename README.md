![logo](./artwork/new-logo/new-logo-playful-minified.svg)

Statechart design, simulation and testing tool, developed with the goal of teaching Statecharts to university students, but probably useful in its own right.

![screenshot](./docs/images/screenshot2.png)


## Features

  - Intuitive editor (inspired by [CouchEdit](https://dl.acm.org/doi/10.1145/3417990.3421401), which was in turn inspired by [StateMate](https://ieeexplore.ieee.org/document/54292))
      - Low cognitive load: concrete syntax is just a bunch of flat shapes, that you can *freely* manipulate.
          - ![](./docs/videos/editing.webp) ![](./docs/videos/editing2.webp)
      - No hidden information: the parser sees exactly what you see, nothing more, nothing less.
      - Visual feedback from parser during editing.
          - ![](/./docs/videos/editing3.webp)
          - Syntax highlighting
  - Builtin action language
      - Variables, simple arithmetic, arrays and dictionaries
      - Pattern matching on event parameters
  - Simulation
      - Time simulation
          - step-by-step
          - (scaled) real-time
      - Coupled execution: controller <-> plant(s) (currently 3 hardcoded plant types: digital watch, traffic light, microwave oven)
          - follows Coupled DEVS
  - Omniscient debugging (= ability to undo execution steps)
      - logging of microsteps
  - Live modeling (= ability to edit model at runtime -- use at your own risk :)
  - Ability to save / restore execution traces
  - Metric Temporal Logic (MTL) property checking on saved traces
  - Visual plot of event parameters and plant state over time
  - Real-world side-effects
       - [MQTT](./docs/mqtt/index.md) (over websocket) client
            - ability to map in/out events to MQTT messages
            - ping-pong example (two browser windows talking to each other):
               ![](./docs/videos/mqtt-pingpong.webp)
  - No need to install anything, everything runs locally in browser

See also the [comparison with Itemis CREATE](./docs/comparison_itemis.md), the tool it meant to replace (for teaching Statecharts).

## Try it now!

<span style="color:red">**Use Firefox or Chrome! For instance, Safari is known not to work 100%. I don't have a Mac so I cannot fix this.**</span>

Live version available here:
[https://deemz.org/public/statebuddy/v2/](https://deemz.org/public/statebuddy/v2)

Or just play with one of the **example models**:

  - [Light Switch](https://deemz.org/public/statebuddy/v2/#eJztVk9vHDUUz05a+gcoUKCMIYWREIIioSRtdksrcaANVJEaCCQgISQUe8az413PeGt7srs9JbtpWqJ+AQ5IFRJHJIqE+Ap8AA5dLl0JuMB1IxAVlGd7/xbEETggJd73/J7t9/x+P8/r3L57DXWndmLVzDRucKWxpu9SqZjIGG3QMNcgReklraOYZVG0wWi9c/vuFdQttKs0YlrIVbMmi2jIsaTRUlbLtRID9c1cG90t8drlMJeSZrqcMAVLm3Gc61xSMH+IutNXq1LkEEdW5lQlEcMpnK2opg2tYiylqKvBQqYop6EJLs7AvLS4DXvsoO6+7bIWtYs01pFilyF+FkVVCBys26i7v4UbuIm8F/2bHVBQ4QLyjpHSPBGyA0vNnP+5v2d/P0KFm2ThdIhhcd+GvBx5r1jrJz4hCy9PGjdQ4X1r/NhfJUVr3Nx1md/XHoRlIzIZWc9fUOEYKZ5MZ2eDi6ycaBWIOO6Au9vxC/9rUjzFx6zZ0Fj4EhWeJ8UFRXKtRbYiqVI0emFN5vTEyOkb5L1HisUEx5rKoKhGe3/nf0+KpYYP1ZDNYDb4AC7anXLPHuD5OymeBs8G05OOr2Ouxj1/Q4UfSWlOT4Z0r9d15D1HSsW/C9wv+cdJqVSGzKUQepRPxaekdLoxD4ZlABmH+wpwwE04gaozHSYBjEmAswDnWrwE1xlollK54wpxoE0B41KHgFhTCrfrCiqccbE9CxJZAOVAP1iFvKpzeht5KSnODUz+t/5XzuD5P5Hi/GjJHVT4zEm/Iu8UKY7tlqHCCSfBurdI6eTItIO8opOuQG1J6dTmDX+xDVHvou7BayO8/yVHhnxyLOlTxjFDpBgYUF4dbHCjT5VD2+YCJuhiqQJ8uDXjIgGe9EXHFEcTN2WI0pfuocpgtSFL32OSLgMHQ5i+wxhlbs3AX79ch9smxlHJbGn+XLH/QrluzewO0fs/rf8pWvuL7mW/vzUBZHvYHTS9bISpqQ4wCGAPkDfgPo6mpsxQGOAZZM8M0+MgBn2fGfaPAxf0+8xwYAhWUA6a4ZAZDkM4EIrL6VM0Xf/3jt9/CXk/uOM3txyZHmhbflO6AeCgNSxx6uR0omTO+cG+8wbmOaUS3hta4Ym6yABwmO85pyPtWIlchnTE0J+PHN1yJXmoNX6cHdkQY9PuDXp4O8PwKG3QFSlqVOpmpeYERlVc4zjTqqrwBo3WJA6pmtp05z7SHhjNE7dixKVFGoosU/1cj7YJfGczyDDSzRpNHZRcnvPlBHNex00+Puu1XEiPbgthmxYLxDdgh6rTXzMZZCwbN1Wsai1EhaP0Js8bzXdg+0nb5N3DJpMTJuHrqPvYLoGGjEhRpfIdyTMgQWLuM8S2P8sVlUkNK1UXMqoqSlf6Mjhhwun5V0mIGcGKrokaC2NtRtVTdXV2dpaLEPNEKH32zNzcfG99vQf/m66Gj7cS0/atwS1XJYU7D6mR19ddx3bsamWDKUYYZ7rJOLBvBWeUV6TJ0IpRjQtNI0ryMtWmhgmcbS0d23o+sRNVaVO55nLkG1P4jkm4NhN9r7fX6/VcQH6L1lkEyQMOU4UKSztuHrVsnRPaqAEvaMRtYQKLOgUNHWoJBiiUGebjk6kr7fhUH1lWLhtIwVfTKhXbHAdaUgq6Dy9euGXma8M+ObAZKkOONuo+uVW2l8NNe9tC3af64J1pJyoR9XPnRMMKFySLmBHOU86Vy/Qq6h6/UjFP3WooBecxJAxXWkkZqKtAXlWxYVqxCsdmipkI1B7y9N5ez530dJulA6QmkKqiy7gWXRYi5eNPq3N+pp2aAi5bN1glUiAQp0M9s0UdqrFrSMqZ0Al0F7al9aM/AJA7FiI=)
  - [Digital watch](https://deemz.org/public/statebuddy/v2/#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)
      - Note: this is the solution to the [Modeling of Software-Intensive Systems 2025-2026 statecharts assignment](http://msdl.uantwerpen.be/people/hv/teaching/MoSIS/assignments/Statecharts).
  - [Microwave oven](https://deemz.org/public/statebuddy/v2/#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)
  - [Traffic light](https://deemz.org/public/statebuddy/v2/#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)


## User documentation

See the [manual](./docs/readme.md).


## Building


1. Get [bun](https://bun.com).
    
    Alternatively, nix users can instead just enter development shell:

    ```
    nix develop
    ```
2. Run:

    ```
    bun build
    ```
3. Build artifacts can be found in `dist/` (`index.html` and a bunch of supporting files). Any static file server can host these files(*). Nothing else is needed.

(*) The only requirement is that the static file server sets the `Content-Type` HTTP header correctly for JS and WASM files. Most servers (e.g., Nginx) do this automatically without any configuration.


## Development

StateBuddy was written in TypeScript, using React as the frontend framework.

Most of the application state sits at the top of the component hierarchy (`AppState`). It is an object that is JSON (de-)serializable and therefore easily persisted in between page reloads. I tried to divide `AppState` into several hierarchical levels of objects such that detecting changes to parts of the `AppState` can be done 
efficiently to decide whether dependant components should re-render or not (memoization). I refuse to use "state management" libraries such as zustand or redux, because they reverse the purely functional paradigm of React by letting components decide which parts of **global state** they access, rather than letting their parents decide which parts they *can* see.

My biggest frustration with React is having to manually specify which values/components to memoize. It feels like something the language itself should be able to figure out. If I were to re-write StateBuddy from scratch, I would probably give [Elm](https://elm-lang.org) a try.

The [statechart language](./src/statecharts/), which could be used independently from the frontend, consists of:
  - type definitions for
      - [concrete syntax](./src/statecharts/concrete_syntax.ts)
      - [abstract syntax](./src/statecharts/abstract_syntax.ts)
      - [runtime configurations](./src/statecharts/runtime_types.ts)
  - and the following transformations, implemented as [pure functions](https://en.wikipedia.org/wiki/Pure_function):
      - [parser](./src/statecharts/parser.ts) (concrete -> abstract syntax)
      - [interpreter](./src/statecharts/interpreter.ts)
          - initialization (abstract syntax -> runtime configuration)
          - step function ((runtime configuration × event) -> runtime configuration)

The action language embedded within the statechart language is parsed by [Peggy](https://peggyjs.org/). Peggy turned out "good enough" for my purposes, although syntax highlighting required more boilerplate than I like. Further, Peggy allows JavaScript code in the grammar file (a feature I have used), which can be considered dirty because now the grammar depends on JavaScript.

For MTL property checking, an existing library was used: [py-metric-temporal-logic](https://github.com/mvcisback/py-metric-temporal-logic). This library and its dependencies are loaded into an instance of Pyodide (CPython compiled to WebAssembly). Compared to the rest of StateBuddy, Pyodide is slow to start (2-3 seconds in my case). Pyodide runs in a pool of web workers, so it doesn't block the main thread (or the DOM). Each worker contains its own instance of Pyodide, so spinning up an extra thread also takes a few seconds (to boot Pyodide).