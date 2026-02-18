# Comparison with Itemis CREATE

|                           | Itemis CREATE                                          | StateBuddy                                                    |
|---------------------------|--------------------------------------------------------|---------------------------------------------------------------|
| profit model              | for profit                                             | not-for-profit (currently)                                    |
| free for academic use     | ✅ yes (yearly license renewal procedure necessary)     | ✅ yes (without license)                                       |
| open source               | ❌ not anymore                                          | ✅ yes                                                         |
| tech stack                | Eclipse Modeling Framework                             | custom, web-based (React app)                                 |
| download size             | >300 MB zipped (need to unzip, trust and run the code) | <10 MB zipped (just a web page -> already sandboxed)          |
| boot time                 | ~7 seconds (not including download time)               | <1 second (includes download time)                            |
|                           |                                                        |                                                               |
| **model editor**          |                                                        |                                                               |
| what you edit             | shapes, nesting, connections, waypoints of connections | just a bunch of flat shapes                                   |
| layout struggle           | ❌ transitions and labels may jump unexpectedly         | ✅ you are in total control                                    |
| hidden information        | ❌ yes (which label belongs to which transition?)       | ✅ no (you see what parser sees)                               |
|                           |                                                        |                                                               |
| **language / semantics**  |                                                        |                                                               |
| triggerless transitions   | ❌ allowed everywhere (confusing semantics)             | ✅ only allowed on pseudo-states                               |
|                           |                                                        |                                                               |
| **simulation**            |                                                        |                                                               |
| scaled real-time          | ❌ no                                                   | ✅ yes                                                         |
| observe execution trace   | ❌ no                                                   | ✅ yes                                                         |
| omniscient debugging      | ❌ no                                                   | ✅ yes                                                         |
| observe micro-steps       | ❌ no                                                   | ✅ yes                                                         |
| breakpoints               | ✅ yes                                                  | not really necessary (omniscient debuggging is more powerful) |
|                           |                                                        |                                                               |
| **code generation**       | ✅ C, C++, Python, Java, ...                            | ❌ not implemented (yet)                                       |
|                           |                                                        |                                                               |
| **testing framework**     | ✅ yes                                                  | ✅ yes                                                         |
| temporal logic            | ❌ no                                                   | ✅ yes (MTL)                                                   |
| inspect execution trace   | ❌ no (you only get an error)                           | ✅ yes                                                         |
|                           |                                                        |                                                               |
| **known bugs**            |                                                        |                                                               |
| timings of generated code | ❌ incorrect (scheduled relative to wall-clock time)    | no code generation                                            |
| duration of event         | ❌ incorrect (until next RTC step)                      | ✅ correct (zero-duration)                                     |
|                           |                                                        |                                                               |