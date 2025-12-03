# Cheat Sheet - StateBuddy

## Editor

### Mouse

 * left mouse button to *select, move, resize*
 * right mouse button to *insert* new states, transitions, etc.
 * middle mouse button only to *select*

### Syntax

#### States

 * Hierarchical states
    * AND-state: has 0..* children. If active, *all* of the children are active. Basic states are modeled as AND-states without children.
    * OR-state: has 1..* children. If active, *one* of the children is active. An OR-state must have one initial states
 * pseudo-state
 * history-state
    * shallow history
    * deep history

#### Text labels

 * comments start with `//`
    * comments are also used to give states a name
 * labels always have the form `trigger [guard] / action0; action1; action2`
    * examples
      * example: `buttonPressed [t == 0] / t=3; ^start`
      * example: `after 2s / ^ringBell`
    * triggers
      * on transitions:
        * `e`, `_e` input / internal event
        * `after 5s`, `after 500ms` timer
      * on states:
        * `entry`, `exit`
 * action language
    * expressions
       * literals
          * `3` numbers
          * `true`, `false` booleans
          * `"hello world"` strings
       * `x` variable references
       * unary operators
          * `!` not (booleans only)
          * `-` negate (numbers only)
       * binary operators
          * `a == b`, `a != b` (not) equals (booleans, numbers, strings)
          * `a > b`, `a < b`, `a <= b`, `a >= b` comparison (numbers only)
          * `+`, `-` sum, difference (numbers only)
    * actions
      * `x = 5` variable assignment
      * `^o`, `^_o` raise output event `o` or internal event `_o`
 * internal event names start with `_` (underscore)


## Semantics

 * The execution of a Statechart is a sequence of Run-To-Completion (RTC) steps
 * An RTC-step can only triggered by:
      * An input event
      * A timer that elapses (actually, an elapsing timer generates an input event behind the scenes)
 * An RTC-step is instanteneous: it takes zero time.
 * In between RTC-steps, the Statechart is idle (it will not change its state), and time may pass.
 * An RTC-step consists of one or more fair-steps:
      * During the first fair-step, only the input event (or timer event) that triggered the RTC-step is active.
      * During a fair-step, orthogonal regions are visited in lexicographical order. For instance, if you have regions labeled A and B, then A will be visited before B.
         *  Within one fair step, every (orthogonal / non-overlapping) region is allowed to fire at most one transition. A region will fire a transition only if it has an enabled transition (wrt. the currently active event, and the transition's guard condition).
         *      When a transition fires: first, all the exit actions of all the exited states are executed (in order: child to parent), then the action of the transition itself, followed by the enter actions of the entered states (in order: parent to child)
            *   In this [example](https://deemz.org/public/teaching/mosis25/statebuddy/#eJx9ldtu4yAQhl+l4jpSzcE2zl23TaVqT9W2d6tdiY3p1lrHRBinSaO8+w6GOPjUGyce+D/+gWF8RDIvjNJPRhiJlkekVVMZUf0tZY2WP4+oKXK0RAlaIKO2X+SLsZP2aJmyeIEOaIkZOS1QXbxLP0BS3A6wKIGBf0Vl9Uqj0+IMi0YwkqQelgxgSeZhdAaWjp1x2moI5QNY5CwTPgfDIxiNiNOM0oyYh0UzMD6CcZy0GspZHwZ5u/yj9AIT8LzQyNgaZZ6WzNHiAe0XMOTehCeLM+SC8F9WRh+urq9+wx+pZX4/ziBze4vT+BRsG5tn3IwYDPvK4VnAIHHA2BemRcDvtAtPyEIXhMwRpjz408M4zIPP57Eau+C+NFIWMuJ5xqcJH9hXUcggbC6TD1xkPQKeI0x4iHxVQvEFedCA4ORy/axFVRemUNXN2j7rESzxbYGRJIQl85tyO2GIOwYlISOdZ9xNbItvHDRMikRz2/KBi5iHBDpHmPCQuSJjCRQZXD2htXoL755l1Uborg3GWXBxpb23vgmd22NYrWyozpyaRLivZqzrhxd1PFDT2NURZWlfzd3aNA3VOBrI05T7K9mXc3Juxr1LggdyzvwqjPflvrppGvYKTAZylqbdaffkvrQZzdoTyAuxUVVuzwDeXosavnwH91LBmT7c2S8OoGUp2/q2QwDcqFyW38RGnkvvuj16pXOprZNX9fZZHoD6IspaLtC7UhvYigUqqlpq8xXkoGyrxs2+h578Q25LsZad6AViz66wYJZ2o5eAlT2WynTzbaD9aj9rKXvRh2rbmNUOnIIlo5suDHelEuV45HtjJhWPpahMGLhVVSX9zQ9XfNRqC4kWsh9eQcto7GzoGzZTB9paqt/NvNlsDsjHLB0AR9hx0RjlF+tkwRr2wAT42Em/MhxiBGuKnczbtc5zAPO01qos+3btat6TD++KuvhTSrvD3oKE26rr1X4LX06Z+4mn/8eIzK0=), when firing the transition from A to F, first the exit actions of A, B, and C are executed, then the actions of the transition itself, and finally the enter actions of D, E and F (in that order).
            *   Any internal events that are raised (as a result of firing transitions), are added to the internal event (FIFO) queue.
      * When a fair-step has completed:
         *  if the internal event (FIFO) queue is not empty, then a new fair-step starts. The next event is popped from the queue, and it becomes the new active event.
         *  if the internal event queue is empty, then no more fair-steps are executed, and the RTC-step ends.
 * Non-determinism (e.g., [multiple enabled outgoing transitions](https://deemz.org/public/teaching/mosis25/statebuddy/#eJx9U0uPmzAQ/i8+UwkH8wjXNpVWfUXd3KoevGHStWpsZJtsshH/vWPsZCG0vUThm/keMwMXAo1w2jw67oDUF2J0rxxXvyRYUv+4kF40pCYlSYjT3Wc4ON90IvU6XSfkTGqWZ0NCrHiFWKCMjQWaMyz8FsrzOf4OyVUtX6jltBxJGavu1LJgQ7PqX2rFMhsNpFWa3qtlQW11r/YTNeDkpjPTlAQQ/8PCo6xoSEyr4S0Lpf/nsLizYvCO3Bj9MrWskGIdN1dCkVfBpCwxL/i4ccBVGLAoJubrBTsslWVszk4jvs6n0Vd39DyuPkvn5nlxvRUbp2gEb7Vq/Bz49Cwsvk7n8KBwEw8f/N5RGiTsndDKl1Cw1Q3Ir7zF2xCl1bsGHJhWKGFbH+RZv3yCM4oeuLSQkFetWxRKiFAWjPuCbCQ6w5UVo2rgfMSbfodO8j3cqAfEduEm2GVC9Q3wtK3U7tbvgfF72BmAGfqgut5tjqD8i+JMf4MxuuJyWfnWu78ytpIrNwXea6XCeuzMcWt0h+MKmMObE+x7370z46RBqPOqcaVN37ZnEjGvjgIXXDvvnY5mN9rEw1+NY44jRGe8ZIqe/AjN6HXtQZnHvdFSzuN6t5gpwkdhxZMEv+EYAfC1N3Zz6vDLgyY2Dn8AAl50Qw==) of the same state) results in a run-time error!

### Example

 Consider the [linked Statechart](https://deemz.org/public/teaching/mosis25/statebuddy/#eJyVVl1v2jAU/SvIz3SNndhJeNtaKlX7qta+TduUgWmjhRg5DoWi/vfdxBewYzqNFwTXPufee+6H2RE5L43S96Ywkkx2RKu2NkX9WMmGTL7vSFvOyYRQSsbEqNUnuTDdrQ2ZiGxMtmRCo+x1TJryRaKdUpH3J0nG4eRPWXcEBXy+jg90LKDLI0vHUp8uFqllS7Ijm9IOmUgCskzEyBYP2HiEbOkbbDQO2JIMU2X8bLY0YOM5dxJyhYstWybeko2FstE8RjZ2LpvgYRHSfULiXDYqTmRqQYwP2ZitacbezDSsAsUqMB6dyybC2HLBkS35T7YfQCE3xp2KJCPWCN8vL0fvAy+MY8x5+noMJ8k92IcQJhJbhjxxYDzyYFfhRAqK3oQLox7s+gRMoDfqwtgRJkeXo5+/FmGcmXUYZ16cjionQCLNEeRGKZgXJX03KkeParQodWNCvymzA8ljlyL2KBhSNHKmoH5hGLhwuJu18EszDbswigWK7Oac+rW5OYFLKG7F3MXRf2pFI56gWJmL8sWKMVPzVOowUfBsW50m4Bm6uNBaPXvLHTCNKfQegcr0cya7AcC9vl/4kRMKywZgwVCfiHtwgZkwT2+WD+AMFw2LqAeHHWLtCXcnSQzhe73idADHVyR2B5Gnw+A59mbiexf7gYQt6zTLEA7S4ARGsa9dxHIM362+GIoH3bWPPx8QxPioJlFfxHlZLKGtuzLCr6eygTd8a3/U0Bi311BGeBkaWcmZKVXdHQHjUs1l9aVYwrYjuq0vjLqYqeWqkv0duP+knj/KLdAuiqqRY/Ki1BLcj0lZN1Kbz4AHaN979vYNrMhvclUVM3kALcD2YNsTbml7ejR0sLtKmcP9ztD/AXnQUnrW23rVmula1t3eNbo9mI3UdVGFJ19bcxJxVxW1cQ1Xqq6tNI3n8U6rFSRaSt883chZ291+0H2mlmjVsaKc83a53BK0dexAsAPJi9YodHaAOT66ihUQx1qiZ6gijEBTrOW897W/AzT3M62qyg+384YxoXldNuXvSnYKYwgSJl43080KHjI5x4uvfwGLFfCd). After initialization, the current states are: OrthogonalState, A, C, E. Then, the Statechart remains idle until it receives an input event. Suppose at time T=5s, the input event e is received. This triggers the execution of an RTC step. The RTC step starts with a fair-step, where regions r1, r2 and r3 (in that order) are allowed to fire at most one transition each. Only r1 has an enabled transition (because event e is active), so only r1 fires. During the firing of that transition, the internal event f is raised, an appended to the internal event queue. The fair-step ends, and one more fair-step is executed, because the internal event queue is not empty. So again, r1, r2 and r3 are allowed to fire at most one transition. This time, the regions r2 and r3 will fire, because event f is active. The second fair-step ends, and since the internal event queue is empty, the RTC step also ends. Even though all transitions fired in a certain order, all of it happened at the same point in (simulated) time. Now, the Statechart will again remain idle until another input event occurs. 

