import type { Extension, ExtensionPoint } from "./extension-points.ts";
import type { Plugin, PluginContext } from "./plugin.ts";

/** An extension together with the plugin that contributed it. */
interface RegisteredExtension {
  extension: Extension<never>;
  owner?: string;
}

/**
 * Holds the registered plugins and the extensions they contribute.
 *
 * The manager is deliberately framework agnostic: the Vue SDK wires it into a
 * Pinia store, but it can also be used on its own.
 */
export class PluginManager {
  private readonly plugins = new Map<string, Plugin>();
  private readonly active = new Set<string>();
  private readonly extensions: RegisteredExtension[] = [];

  /** Register a plugin. Throws when the id is already taken. */
  register(plugin: Plugin): void {
    if (!plugin?.id) {
      throw new Error("A plugin must have an id.");
    }
    if (this.plugins.has(plugin.id)) {
      throw new Error(`A plugin with id "${plugin.id}" is already registered.`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  /** Remove a plugin and everything it contributed. */
  unregister(id: string): boolean {
    if (!this.plugins.has(id)) return false;
    this.plugins.delete(id);
    this.active.delete(id);
    this.removeExtensionsOf(id);
    return true;
  }

  /** Look up a registered plugin. */
  get(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /** List every registered plugin. */
  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /** List the ids of the currently active plugins. */
  getActiveIds(): string[] {
    return Array.from(this.active);
  }

  /** True when the plugin is currently active. */
  isActive(id: string): boolean {
    return this.active.has(id);
  }

  /**
   * Activate a plugin.
   *
   * Activating an already active plugin is a no-op. When the plugin throws it
   * stays inactive and the error is re-thrown.
   */
  async activate(id: string, context: PluginContext): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new Error(`Plugin "${id}" not found.`);
    }
    if (this.active.has(id)) return;

    this.active.add(id);
    try {
      await plugin.activate(this.createContext(context, id));
    } catch (error) {
      this.active.delete(id);
      throw error;
    }
  }

  /** Deactivate a plugin and drop the extensions it contributed. */
  async deactivate(id: string): Promise<void> {
    if (!this.active.has(id)) return;

    const plugin = this.plugins.get(id);
    this.active.delete(id);
    this.removeExtensionsOf(id);

    if (plugin?.deactivate) {
      await plugin.deactivate();
    }
  }

  /**
   * Activate every registered plugin.
   *
   * A plugin that fails to activate does not stop the others; the failure is
   * reported through the returned list.
   */
  async activateAll(
    context: PluginContext,
  ): Promise<{ activated: string[]; failed: Array<{ id: string; error: unknown }> }> {
    const activated: string[] = [];
    const failed: Array<{ id: string; error: unknown }> = [];

    for (const plugin of this.list()) {
      try {
        await this.activate(plugin.id, context);
        activated.push(plugin.id);
      } catch (error) {
        failed.push({ id: plugin.id, error });
      }
    }

    return { activated, failed };
  }

  /** Deactivate every active plugin. */
  async deactivateAll(): Promise<void> {
    for (const id of this.getActiveIds()) {
      try {
        await this.deactivate(id);
      } catch {
        // A failing deactivation must not block the remaining plugins.
      }
    }
  }

  /** Register an extension on behalf of the host application. */
  registerExtension<THandler>(extension: Extension<THandler>): void {
    this.extensions.push({ extension: extension as Extension<never> });
  }

  /**
   * List the extensions registered at a point, highest priority first.
   *
   * Extensions with the same priority keep their registration order.
   */
  getExtensions<THandler>(point: ExtensionPoint): Array<Extension<THandler>> {
    return this.extensions
      .filter((entry) => entry.extension.point === point)
      .sort((a, b) => (b.extension.priority ?? 0) - (a.extension.priority ?? 0))
      .map((entry) => entry.extension as unknown as Extension<THandler>);
  }

  /** Remove every extension contributed by a plugin. */
  private removeExtensionsOf(pluginId: string): void {
    for (let i = this.extensions.length - 1; i >= 0; i--) {
      if (this.extensions[i].owner === pluginId) {
        this.extensions.splice(i, 1);
      }
    }
  }

  /**
   * Build the context handed to a plugin.
   *
   * `registerExtension` is bound to this manager so the contributed
   * extensions can be removed again when the plugin is deactivated.
   *
   * The context is created with `Object.create` so it inherits every member of
   * the host context. A host application may extend the context with its own
   * members (the Vue SDK adds the Pinia stores and the slot and command
   * registries) and those members must survive the activation.
   */
  private createContext(base: PluginContext, owner: string): PluginContext {
    const context = Object.create(base) as PluginContext;
    context.registerExtension = <THandler>(extension: Extension<THandler>) => {
      this.extensions.push({
        extension: extension as Extension<never>,
        owner,
      });
    };
    return context;
  }
}
