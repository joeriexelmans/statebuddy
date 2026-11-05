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

export function chunkedLength<T>(arr: T[][]) {
  return (arr.length-1)*500 + arr.at(-1)!.length;
}

export function flatIdxToChunked(idx: number) {
  return {
    i: Math.floor(idx / 500),
    j: idx % 500,
  };
}

export function chunkedIdxToFlat({i, j}: {i: number, j: number}) {
  return i*CHUNK_SIZE + j;
}
