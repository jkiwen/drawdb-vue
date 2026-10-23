/**
 * Extension points the SDK exposes to plugins.
 *
 * A plugin contributes behaviour by registering an extension at one of these
 * points; the SDK collects the extensions and hands them to the component that
 * renders that part of the UI.
 */
export const EXTENSION_POINTS = [
  "toolbar",
  "context-menu",
  "panel",
  "dialog",
  "command",
  "field-type",
  "export-format",
] as const;

export type ExtensionPoint = (typeof EXTENSION_POINTS)[number];

/** True when the value is one of the known extension points. */
export function isExtensionPoint(value: string): value is ExtensionPoint {
  return (EXTENSION_POINTS as readonly string[]).includes(value);
}

/** A contribution registered at an extension point. */
export interface Extension<THandler = unknown> {
  /** Unique id of the extension. */
  id: string;
  /** The point the extension is registered at. */
  point: ExtensionPoint;
  /** Higher priorities are rendered first. Defaults to `0`. */
  priority?: number;
  /** The contributed behaviour. */
  handler: THandler;
}
