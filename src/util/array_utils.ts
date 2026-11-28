export function* range(n: number) {
  for (let i=0; i<n; i++) yield n;
}

export function count<T>(arr: Array<T>, predicate: (x: T) => boolean) {
  let count=0;
  for (let i=0; i<arr.length; i++) {
    if (predicate(arr[i])) {
      count++;
    }
  }
  return count;
}

export function withGrow<T>(arr: T[], i: number, value: T, fill: T) {
  if (i >= arr.length) {
    arr = [...arr, ...new Array(i - arr.length + 1).map(_ => fill)];
  }
  return arr.with(i, value);
}

// resize array and if new entries are created, fill them with given value
// it is also possible to call a 'destructor' on deleted elements when shrinking the arrayf
export function arrResizeDefault<T>(arr: T[], newSize: number, fill: T | (() => T), destroy?: (el: T) => void) {
  const keep = arr.slice(0, newSize);
  if (destroy) {
    const kill = arr.slice(newSize);
    kill.forEach(destroy);
  }
  let newElems;
  if (typeof fill === 'function') {
    newElems = Array.from(Array(Math.max(0, newSize - arr.length))).map(fill as () => T);
  }
  else {
    newElems = Array.from(Array(Math.max(0, newSize - arr.length))).map(_ => fill);
  }
  return [
    ...keep,
    ...newElems,
  ];
}
