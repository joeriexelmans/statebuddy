export const CHUNK_SIZE = 500;

// Because React uses copy-on-write for state updates, it is more efficient to represent very long lists as arrays of arrays.
export function chunkedPush<T>(oldArray: T[][], elem: T): T[][] {
  if (oldArray.length === 0) {
    return [[elem]];
  }

  const lastChunk = oldArray.at(-1)!;
  if (lastChunk.length < CHUNK_SIZE) {
    // append to last chunk
    const prefix = oldArray.slice(0, -1);
    return [...prefix, [...lastChunk, elem]];
  }
  else {
    // add new chunk
    return [...oldArray, [elem]];
  }
}

export function flatIdxToChunked(idx: number) {
  return {
    i: Math.floor(idx / CHUNK_SIZE),
    j: idx % CHUNK_SIZE,
  };
}

export function chunkedIdxToFlat({i, j}: {i: number, j: number}) {
  return i*CHUNK_SIZE + j;
}

export function chunkedFirst<T>(arr: T[][]) {
  return arr[0][0];
}

export function chunkedLast<T>(arr: T[][]) {
  return arr.at(-1)?.at(-1);
}

export function chunkedLength<T>(arr: T[][]) {
  return (arr.length-1)*CHUNK_SIZE + arr.at(-1)!.length;
}

export function chunkedBinarySearch<T>(arr: T[][], end: T, fn: (elem: T, next: T) => Cmp): {i: number, j: number} {
  // 1. find the chunk
  // console.log('find chunk, numchunks=', arr.length);
  
  const i = binarySearch(arr, [end], (chunk, nextChunk) => {
    return fn(chunk[0], nextChunk[0] || end);
  });
  // 2. find within chunk
  // console.log('i=',i,' find within chunk');
  const j = binarySearch(arr[i], end, fn);
  return {i, j};
}

type Cmp = "eq-smaller" | "eq-bigger" | "toosmall" | "toobig";

function binarySearch<T>(arr: T[], end: T, fn: (elem: T, next: T) => Cmp): number {
  let min = 0;
  let max = arr.length-1;
  while (true) {
    const middle = Math.floor((min+max)/2);
    const cmp = fn(arr[middle], arr[middle+1] || end);
    if (cmp === "eq-smaller") {
      return middle;
    }
    else if (cmp === "eq-bigger") {
      return middle;
    }
    else if (cmp === "toobig") {
      max = middle-1;
    }
    else {
      min = middle+1;
    }
    if (min === max) {
      // throw new Error('not found');
    }
  }
}
