/**
 * Generate a unique identifier for tables, fields, relationships and notes.
 *
 * Uses `crypto.randomUUID` when available (browsers and Node 19+), and
 * falls back to a time/random identifier elsewhere.
 */
export function createId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
