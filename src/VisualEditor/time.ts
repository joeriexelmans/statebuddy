
export type TimeMode = TimePaused | TimeRealTime;

// When the simulation is paused, we only need to know the current simulated time.
export type TimePaused = {
  kind: "paused",
  simtime: number, // the current simulated time
}

// When the simulation is running in real time, we need to know the time when the simulation was set to real time (both in simulated and wall-clock time), and the time scale. This allows us to compute the simulated time of every future event.
// Such a 'future event' may be:
//  - raising an input event
//  - changing of the time scale parameter
//  - pausing the simulation
export type TimeRealTime = {
  kind: "realtime",
  since: {
    simtime: number,  // the simulated time at which the time was set to realtime
    wallclktime: number, // the wall-clock time at which the time was set to realtime
  }
  scale: number, // time scale relative to wall-clock time
}

export function getSimTime(currentMode: TimeMode, wallclktime: number): number {
  if (currentMode.kind === "paused") {
    return currentMode.simtime;
  }
  else {
    const elapsedWallclk = wallclktime - currentMode.since.wallclktime;
    return currentMode.since.simtime + currentMode.scale * elapsedWallclk;
  }
}

export function setRealtime(currentMode: TimeMode, scale: number, wallclktime: number): TimeRealTime {
  if (currentMode.kind === "paused") {
    return {
      kind: "realtime",
      scale,
      since: {
        simtime: currentMode.simtime,
        wallclktime,
      },
    };
  }
  else {
    return {
      kind: "realtime",
      scale,
      since: {
        simtime: getSimTime(currentMode, wallclktime),
        wallclktime,
      },
    };
  }
}

export function setPaused(currentMode: TimeMode, wallclktime: number): TimePaused {
  if (currentMode.kind === "paused") {
    return currentMode; // no change
  }
  else {
    return {
      kind: "paused",
      simtime: getSimTime(currentMode, wallclktime),
    };
  }
}
