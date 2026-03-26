export function prettyNumber(n: number): string {
  if (n >= 1000) {
    return `${Math.floor(n / 1000)},${(n % 1000).toString().padStart(3, '0')}`;
  }
  return n.toString();
}
