![logo](./artwork/new-logo/new-logo-playful-minified.svg)

Statechart design, simulation and testing tool, developed with the goal of teaching Statecharts to university students, but probably useful in its own right.

![screenshot](./docs/images/screenshot2.png)


## Features

  - Intuitive editor (inspired by [CouchEdit](https://dl.acm.org/doi/10.1145/3417990.3421401), which was in turn inspired by [StateMate](https://ieeexplore.ieee.org/document/54292))
      - Low cognitive load: concrete syntax is just a bunch of flat shapes, that you can *freely* manipulate.
          - ![](./docs/videos/editing.webp) ![](./docs/videos/editing2.webp)
      - The parser is **passive**, in the sense that it does not interfere with / limit what you can draw. You get visual feedback of what it *thinks* you are doing, and that's about it:
          - ![](/./docs/videos/editing3.webp)
      - No hidden information: the parser sees exactly what you see, nothing more, nothing less.
  - Builtin action language
      - Variables, simple arithmetic, arrays and dictionaries
      - Pattern matching on event parameters
      - Syntax highlighting
  - Simulation
      - Time simulation
          - step-by-step
          - (scaled) real-time
      - Coupled execution: your statechart can interact with a simulated "plant" (e.g., a traffic light, microwave oven, ...)
          - implements Coupled DEVS theory
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

<span style="color:orange">*Note: Safari is known not to work 100%. I don't have a Mac so I cannot fix this. Use Firefox or Chrome.*</span>

**Live version:**
[https://deemz.org/public/statebuddy/v2/](https://deemz.org/public/statebuddy/v2)

Or just play with one of the **example models**:

  - [Digital watch](https://deemz.org/public/statebuddy/v2/#eJydWguQHMV51jx2hRVsDIYwv5Bg4QS+kxDa9wNVAIGQrDKgM3fYYIxO0zuzu3M7O7OamdXtYUNOeychU3YcPzDyAyxslwuwweAHxm87TuQKtqtSzsNc4kIXxQlxHCeqygk5oRLyT/fs9Mze6WT7qu727/6+/vvvv7v//rv35o+/9l5YWPWA6Xqqp79dd1zDtmrutOWpXa1mWJqhd/Vqx8NarbXP87T9hj7V1DXDs50xv4k8f/y1g7AgzFqaXjVVR9d2We2O59r94u6O55ejbQ6yNuKsru/XLa/RVh21Nd71mq66X9dG/ZI7SWzPs1u36DVvb0/foZquro07HX0em9U9u70s0EDgdqPeWIo0mbrlwUkcvONtQ3Nbe2feVzes6rjR0jWi6+1JVzf1qneb3vVMrB+jJXRGw9VZg7o/LsOqm5rhtk11mlY2g4KvRjf9PltBzU0Nx7bspqNjeyYbqJZJzCvSbL1huOiq6Xq14zjon1qt43UcfWaezpX8gOH2rWg6dgdnCnvX3YZmqC2cJbffvKY6jj2F/aDtbs3Cv7u2Hz2yDrUcgoXEXLVjaH1Haq5xr641cbrVDOJzsJDsqV11Wikqt8+jDKsvB/mLVdXSWOvVc7GWvira2ucqu0GcoY3kBIh1NUdsZx5bsCpHMagg/iVI29RsFBMVEB9n0sUgXqrmI6CyWzEZtBqE/1ILsXb7lBYVhBM+Voz1tx+kY4z1QxCuVEsx8EkQawzcD8JGtRwFpU0gibTrl0F4TK1Ejfmw8o/08wkQ3kEy6SiE/V1GhXtB+DjJZKjPwg5fAGGEdZhTtpNMNoYmzgHxY2wgP1B2kUwujt6mvJeB71LGSCYfA8XHQHiWoaayjWQKcfQJ5QQDJ5WtJFOMgdIYSDuoxc8qJskOGPwXIHyfgj9XRkmmFFe7FaQGBTvKQyRTjoHJDSB8J2i5g2Qq8bG8AtKbKfiCcgvJpuNgAqSrKfhX2DIb95H8E5A3U/BPFEKycRdJBsgpCj6o3EWycRcl/xjkLRR8j/IOko17SDgEwnjQchfJxjykPAXCj6kwjY7PxnygfAUEZusouj1LXTAzc2Qz28nnzPobQ6fBpapbGslWKPd+ZSP9fEh5KyO+bpaT/CYU/RoI51Lhb3Hhklx6HmnM2OtAOI9JnwDhFpLL9CHlVyD8kAr/BMJ7SC4bAseU55gu5R9ILsdVPQ7Co0waAeEVksuHkLRB+TYTSspLJFfggA5CiklVED5PcsUQEudBeDqUhkmuFELyeSDMs1ZfB+E3JFfm0Iu4QtnUiyA+Q3KVEErcCiIbauIWEFWS515IdjEWhBJCGQ7dituASbtB+BrJZzn0AxC+F0ouyXNfyP+L+yOUvkHy3BeJJgjfZFILBI/kuTf8dc68kRxSfkHy3BmJ55WXmIAzuYHkuS+SfwbSdUw6BtIekue+SBZA/CWTyiBdSvLcF8nPBZsGkp8F8VekwH2RWI8VTEqBtJEUuC8ST4I0zKQnQPxPUuC+SBwH8WEmLYDQJYWILxZwwpj0G5DfTAoRX1wL8keYtBrkh0iB+0J8J0gVJtVBUkmBO0Pa2zdemsbBkwL3hvgsSMH+vRKkg6TAvSH9DUjPMemvQVZIgXtDegjk9Uz6KEjfJEXuDWkYpJ8x1c+B9HekyPfHYyD+OxW+CtJaUuT7YxGknazJ60HaRYrcFeKFIPUo5xRIM6QY2SGbQL6YIq+AfBEpRrbICMjbKILeu54UI364GuQ6RU6DrJMid4O0EeTDQT/yYVLkXkhMgMyMS3ZA3kGKkTXxbpDZeZpogNwkpcj+eF75ERO+pBwlJb4ipH8D4Skm/SuuXVLiK0J+PwjXM+nPQfgjUsodeQuLUGvCnIue9X5KwcLG25Q/JaV8bYgmOfPIY80fVz5BSoXGUJD1hEDipPIIKZWsoSrNeLYPwOKPfLhYD+CwPvlz5aukVO5expPCYT95G0ltWbMnkkvxfk4r3yKlip9dOtOpLak9sfSL0x5XFkk53QrGxnT2UeVl5VQ1k840hyzbG8VeMGMMW0p3gCCRcqY/kjFU0Y7gyRIISVLOLq+aHjhXkXKuu76fsTLCGjTV5EVu6C9B2ErKeXPIw5Ry0G1SDYSdpFzobopkuYHCuw2L5tzDcZeP3BMO8+9BuJ2USwabw921Gu8Vz5M7SbnoDbrRz2v5WH4Cwn2kXG4MtQedhAtshpQr3Y2D83Z2s0B+FYQeqaS7qSWN0ZAJz65j1kuzbe50nJQHSCW7b4kb+Ap7iVIyv5+rfgHCZ0gl11XUmqc7qaybCueL3ih4PxjjhSdJJe9EuxngJO7HrI1UCvsiAxyg+Cf8MVIp2uEyGSBId4PwIqmEO+r2jmXhbYT3UQRhgVTK7aEpld5TdtjOgNM+CMI/k0rF6jPG7ZvxSsM1DINwEvdBujO4CmJ6FJzr09VysdRi62jMM0xzt8XV/AuIa1BNtruZOa/g+vMY3J6CYW1dgxOLa8s3YMlIfwbiG1BBboq1z6Rb1P38+hSO6CCIVyAz393E52lN2BWd7FhPA3vtJhCL2LzQXXvm5nyZ/geI9yG72BgKGHzy0I4vIVSqDakxl/u++C4CuGUCn/NRDoN4DKFKg7WJeFD8Doj/U81k0l0lnIn+LXTQqmQRxP9DbqY9uHm4EZfgBQcpK+6Wb4F0PnJwxetdw4v1GMwY7/IpPFORm19hOSeeBmkdcoorbQsJD+f1SCpYzAU34sW7GfPr/SBtRULJXDYK4FEo3Yxw2Ryq23Q930aPq76dd+GFB+FKcwiXjqOrblR38gRIu6uZbLrZX2W4zLhpz4D0LkQzrYhpkSlK3o2ZDuJZvleijwbcRMyPNOTl3MhM9t8Z+DjvA2k/ssrLj1N6msF5Hp6XOzrEX4P0bqQVIq8cXMdRkN6HYLEV6vBfPWJ9fBrxktef/2WjHd6fpc8hrTLJ/LJLM/n5gLmb9NNqJtd3aSHm0sRLIC0gmtHp0RaGk6+AdAKrs0awDyLHkojXx5cRyzWYwnxkgh4E6b8Ryi/bl3AA01pEC2c6lfGOWEG8ZMVP5eiBKF+HhKJ9puAhfQHktyGjEl28UeOT3wZ5T7WSxeXnqxhVO9ETU8CAMlHN5NMrbMrERSBXsYsySwbGjWp8d8yA3EMV2RW2/q8ZJdM+Y7RNDIH8DFJybrAP+rHWP/pB+vIMeyb6g17DfyQcx2XbdHQ8FKq6Lzf6J+lepD0AC+ceRBNRjYrbAHMy9jHq2G3d8aYn20wwdLeGGizPZe+A40jXXZZ/vn5W9/yi5ttbNbTuadb/G3r03anuGi0fqbWpO1etWjXXXbczNWxYE/2ZTG2+LmV3vAm6fke61yMag69KDd+Zuj9SMzLiNxneeXf66mw6nb4nNcybj4x07/AVTKletTERHId+qEEbUFOgxvc8lu5M8SLTeWdqsCE7wc6klqG/l2LfopER5sTzZvv+9R8DR31x13a9aluWe4Ax3jhLMLu31BY6erqtW5pRNzzVZFqLOv1oxSpXf5C9CJ4/Z9v0ofdWW9PN21BDk5Vv9nNwTEmi0CQtUoS41ehj6ECPzVhuf/4csuMPqQP81kCaT1uwB9jBsQQXFsqIPtcOWhDLeCk79tI7QDfjqRHl91+IB6j1MF2gLP4MPMCLvA8zZvj0PEAM6/t2Ro+eQTvjxxLlR566B9iT0cOJcunb+ABLYycHG3MQKQbHHFT7rCV9hKcTtSVyVi3hhs/8vjf68jK8/p3VNygQl2FFvxrwF0OkuJydPKr6dvLSXM+kayplW1tsDPg0Pl3QY3GraaquN2a0/MH3GPSmXj9qNYla311jX5uAdPIAwy/s0Y2o0y9HusqGuBlhmDo1j5rggmsOzGOLM9MWYfPDvXbUwNRwFsP9Bb05qiAxchYFrJ/V3ztbP5S25vhvpe3Cl89q9aZP9rrrWPaTYjccPId8p6XCp4VwCD+l2qaWUebPD+sy+YEVScz8c5O/haZz96ysCUov9lqeY9TreHwG+f8FvR5tK69lA1872JgvJ9ZJ4oWzEhfhmg24Yj4ACxe9n9iWQRy7qTt3OKaldrwGhlijqtKv7/BkdBpt1XWnbEdrujrmHkxGkkpM/aZtpKoaRHX1cbttVGue/xdjiv9hsgCuttsYsVpBpGelRXfKvXbLFtOuqmbDdr1rK+l0ZnHv3kX8nemmKplyJZfGe2Ge1GrlXLpWyVQKpJTHFJuoaV3b66cID8LCHx6uuVXHNs3J/YZrEMM0vGnDxPGNqpZuTjr+cqCi1jZtT9d00qmzveVHAIqwfXNxr8a+amQoq1R6BtOOQ5tkku+7VavmEcK/x187DAtwSGvq0y792jPSS013HNtBR/hOWlxcPHVqkZ2Wa2cDk/UpQ0NXG57uJ5u+QszCDrKeL+nRo7Shd9uqpelacATj9F7SY15N0S9BWY1N0yQL5zlSGfg7WlX3T20Mybhe1872u/xxz4ci6RSltsMvcFPUIVh7/LVZWFh3oE49bfouOrIBFtYfucIIU5xmJBPqXnLi0MMsdJw49CH8PUIX4TW0ah9irBjSL19S1W/XLzejckRZd11oAG3CIDSFoVewss+JaY7aeiXLgJZw3OpElHYZlpfpa6LflxXnm1G6Fac6S3tcdhwTA+NYamOkwzqjuF2atAbHZurEo49yXUFll+alkTQFWY9wVgQY1PXIUl1Ru6P4CnYjLerYoWU4Jz919MEYaWTQZMpY1ubLozbHaX2j13Oj44QVrP7oN2IGRceNUFwDGc2S0RwZTZPRTPcqro3H4L6+SPimP4vBhx8zaOQ4FfzBH5Y3XzrXcBv21I032l0q7HQMHD0KN+mm6dZ9add2N+DjTeqyg5MY1u0xGndqGHPQvsmWgcUxT2+7kzS6ULGJu91yDX/ju6dAmGAqMGylZo1WPxNvYGxxdYzk2r223Yqn9ox9+WzLj8K3Uh42s1t4QzD1sGzRyBwWayxVrFu2fwmsT3IjlHeyQH/F4d/5vxb4PzzYLdW/7IapK56OiTk17V9ZX71h7I2r/J9Xb9hzlAqsdu/zQe1dJ6nAvqPFhufM0q8akz3ljldvGF2INLmnrygQZoSZ0/8PUF4mVA==)
      - Note: this is a solution to the [Modeling of Software-Intensive Systems 2025-2026 statecharts assignment](http://msdl.uantwerpen.be/people/hv/teaching/MoSIS/assignments/Statecharts).
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

StateBuddy was written in TypeScript, using React to render HTML (client-side only). No frontend framework (e.g., MUI) was used, just plain CSS (sometimes a pain, I must admit).

### Application State

The entire application state sits at the top of the component hierarchy, and children components receive their relevant parts of the state as properties. Children also receive 'partial setters' (setters that only update part of the application state) if they need to update parts of the application state.

I avoid global state management libraries such as Zustand and Redux because I prefer an architecture where component dependencies are explicitly determined by their parents. Rather than allowing components to independently reach into global state and decide what they can access, I prefer parents to control which parts of the application state are exposed to their children through props.

### Persistance with CBOR

The entire application state is persisted in between page reloads. To make this happen, it is CBOR-serialized (+ DEFLATE-compressed + base64-encoded) into the URL hash. The reason for choosing CBOR over JSON is that CBOR supports structural sharing (preserved in a round-trip!), reducing data usage by an order of magnitude when working with long edit histories. I do this with mixed feelings, because CBOR is a much less established format than JSON.

### Visual Editor

The visual editor for drawing Statechart models was created from scratch with React rendering SVG elements that contain mouse event handlers, and CSS classes for visual feedback when hovering an element. Looking back, I am very happy not to have used an existing "diagramming" library. An existing library would have made it difficult to customize editing behavior. Rolling my own solution was also surprisingly easy and gives me complete control.

### Statechart Language

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

### Action Language

The action language parser is generated from a grammar by [Peggy](https://peggyjs.org/). Peggy turned out "good enough" for my purposes, although syntax highlighting required more boilerplate than I'd like. Further, Peggy allows JavaScript code in the grammar file (a feature I'm using), which can be considered dirty because now the grammar depends on JavaScript.

### MTL Property Checking

For MTL property checking, a Python library was used: [py-metric-temporal-logic](https://github.com/mvcisback/py-metric-temporal-logic). This library and its dependencies are loaded into an instance of Pyodide (CPython compiled to WebAssembly). Compared to the rest of StateBuddy, Pyodide is slow to start (2-3 seconds in my case). Pyodide runs in a pool of web workers, so it doesn't block the main thread (or the DOM). Each worker contains its own instance of Pyodide, so each thread requires a few seconds to spin up. Property checking is not incremental: for every new step in the execution, the entire trace needs to be checked again. This is far from optimal.

### Philosophical Reflection

I am happy with React's paradigm of explicit, immutable application state and pure render functions. Memoization, on the other hand, requires more manual configuration than theoretically necessary. If I were to re-write StateBuddy from scratch, I would probably give [Elm](https://elm-lang.org) or [PureScript](https://www.purescript.org/) a try.

### Source Code

The source code is mirrored in two locations. Both are kept up-to-date.

  - https://deemz.org/git/research/statebuddy
  - https://github.com/joeriexelmans/statebuddy
