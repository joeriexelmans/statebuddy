export function stepUp(steps: number[], current: number, threshold = 0.1) {
  for (let i=0; i<steps.length; i++) {
    if (steps[i] - current > threshold) {
      return steps[i];
    }
  }
  return current;
}

export function stepDown(steps: number[], current: number, threshold = 0.1) {
  for (let i=steps.length-1; i>=0; i--) {
    if (current - steps[i] > threshold) {
      return steps[i];
    }
  }
  return current;
}
