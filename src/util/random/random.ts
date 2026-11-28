
export function generateRandomHexString(bitsOfInformation: number) {
  return [...crypto.getRandomValues(new Uint8Array(Math.floor(bitsOfInformation / 8)))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
