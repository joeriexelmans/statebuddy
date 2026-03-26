export async function inflateJSON<T>(compressedState: string): Promise<T> {
  const inflated = await inflateString(compressedState);

  let recoveredState;
  try {
    recoveredState = JSON.parse(inflated);
  }
  catch (e) {
    // @ts-ignore
    throw new Error("failed to recover state (invalid JSON):" + e.toString());
  }

  return recoveredState as T;
}

export async function inflateString(str: string): Promise<string> {
  const compressedBuffer = base642buf(str);
  const decompressedBuffer = await inflateBuf(compressedBuffer);
  const decoded = buf2string(decompressedBuffer);
  return decoded;
}

export async function inflateBuf(buf: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter();
  writer.write(buf).catch(() => { }); // any promise rejections will be detected when we try to read
  writer.close().catch(() => { });

  let decompressedBuffer;
  try {
    decompressedBuffer = await new Response(ds.readable).arrayBuffer();
  }
  catch (e) {
    // @ts-ignore
    throw new Error("failed to recover state (valid base64 but corrupted data):" + e.toString());
  }
  return decompressedBuffer;
}

export function buf2base64(buf: ArrayBuffer): string {
  const str = new Uint8Array(buf).toBase64();
  return str;
}

export function base642buf(str: string): Uint8Array<ArrayBuffer> {
  let buf;
  try {
    buf = Uint8Array.fromBase64(str); // may throw
  } catch (e) {
    // @ts-ignore
    throw new Error("failed to recover state (invalid base64):" + e.toString());
  }
  return buf;
}

export function str2buf(str: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(str);
}

export function buf2string(buf: ArrayBuffer): string {
  let decoded;
  try {
    decoded = new TextDecoder().decode(buf);
  }
  catch (e) {
    // @ts-ignore
    throw new Error("failed to recover state (could not decode buffer to UTF-8):" + e.toString());
  }
  return decoded;
}

export async function deflateString(str: string): Promise<ArrayBuffer> {
  return deflateBuffer(str2buf(str));
}

export async function deflateBuffer(buf: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(buf);
  writer.close();
  return new Response(cs.readable).arrayBuffer();
}
