import type { MetadataRegistry } from "../metadata/metadata-registry.ts";
import type { Diagram } from "../models/diagram.ts";
import type { Extension } from "./extension-points.ts";

/**
 * The API a plugin receives when it is activated.
 *
 * The diagram is a read-only snapshot: plugins mutate the diagram through the
 * host application's stores, not by writing to this object.
 */
export interface PluginContext {
  /** Read-only view of the diagram the editor currently shows. */
  readonly diagram: Diagram;
  /** Registry of metadata schemas the plugin can read and extend. */
  readonly metadata: MetadataRegistry;
  /** Contribute an extension at one of the SDK extension points. */
  registerExtension<THandler>(extension: Extension<THandler>): void;
  /** Read a store exposed by the host application, e.g. `diagram`. */
  getStore<TStore>(storeId: string): TStore | undefined;
}

/** A unit of functionality the SDK can load at runtime. */
export interface Plugin {
  /** Unique id of the plugin. */
  id: string;
  /** Human readable name. */
  name: string;
  /** Semantic version of the plugin. */
  version: string;
  /** Longer description of what the plugin does. */
  description?: string;
  /** Author of the plugin. */
  author?: string;
  /** Called once when the plugin is activated. */
  activate(context: PluginContext): void | Promise<void>;
  /** Called once when the plugin is deactivated. */
  deactivate?(): void | Promise<void>;
}
