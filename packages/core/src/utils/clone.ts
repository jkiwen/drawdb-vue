/**
 * Framework agnostic deep clone.
 *
 * `structuredClone` refuses to serialise exotic objects such as the proxy
 * objects a reactive framework hands out, so commands that snapshot state use
 * this helper instead. It walks plain objects, arrays and dates by hand and
 * therefore also works on reactive proxies.
 */
export function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }

  if (value && typeof value === "object") {
    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      clone[key] = deepClone((value as Record<string, unknown>)[key]);
    }
    return clone as unknown as T;
  }

  return value;
}
