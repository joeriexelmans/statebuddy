
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

// given a wall-clock time, how does it translate to simtime?
export function getSimTime(currentMode: TimeMode, wallclktime: number): number {
  if (currentMode.kind === "paused") {
    return currentMode.simtime;
  }
  else {
    const elapsedWallclk = wallclktime - currentMode.since.wallclktime;
    return currentMode.since.simtime + currentMode.scale * elapsedWallclk;
  }
}

// given a simulated real time clock, how long will it take in wall-clock time duration until 'simtime' is the current time?
export function getWallClkDelay(realtime: TimeRealTime, simtime: number, wallclktime: number): number {
  const currentSimTime = getSimTime(realtime, wallclktime);
  const simtimeDelay = simtime - currentSimTime;
  return Math.max(0, simtimeDelay / realtime.scale);
}

// given a current simulated clock (paused or real time), switch to real time with given time scale
export function setRealtime(currentMode: TimeMode, scale: number, wallclktime: number): TimeRealTime {
  return {
    kind: "realtime",
    scale,
    since: {
      simtime: getSimTime(currentMode, wallclktime),
      wallclktime,
    },
  };
}

// given a current simulated clock (paused or real time), switch to paused
export function setPaused(currentMode: TimeMode, wallclktime: number): TimePaused {
  return {
    kind: "paused",
    simtime: getSimTime(currentMode, wallclktime),
  };
}

export function timeTravel(currentMode: TimeMode, simtime: number, wallclktime: number): TimeMode {
  if (currentMode.kind === "paused") {
    return {kind: "paused", simtime};
  }
  else {
    return {kind: "realtime", scale: currentMode.scale, since: {simtime, wallclktime}};
  }
}