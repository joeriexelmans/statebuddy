
export type TimeMode = TimePaused | TimeRealTime;

export type TimePaused = {
  kind: "paused",
  simtime: number, // the current simulated time
}

export type TimeRealTime = {
  kind: "realtime",
  scale: number, // time scale relative to wall-clock time
  since: {
    simtime: number,  // the simulated time at which the time was set to realtime
    wallclktime: number, // the wall-clock time at which the time was set to realtime
  }
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
