import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyDiagram } from "../models/diagram.ts";
import { MetadataRegistry } from "../metadata/metadata-registry.ts";
import type { Plugin, PluginContext } from "./plugin.ts";
import { PluginManager } from "./plugin-manager.ts";

const makePlugin = (overrides: Partial<Plugin> = {}): Plugin => ({
  id: "p1",
  name: "Test Plugin",
  version: "1.0.0",
  activate: () => {},
  deactivate: () => {},
  ...overrides,
});

const makeContext = (): PluginContext => ({
  diagram: createEmptyDiagram({ database: "mysql" }),
  metadata: new MetadataRegistry(),
  registerExtension: () => {},
  getStore: () => undefined,
});

test("plugin manager: registers and lists plugins", () => {
  const manager = new PluginManager();
  manager.register(makePlugin());

  assert.equal(manager.list().length, 1);
  assert.equal(manager.get("p1")?.name, "Test Plugin");
});

test("plugin manager: rejects a duplicate plugin id", () => {
  const manager = new PluginManager();
  manager.register(makePlugin());

  assert.throws(() => manager.register(makePlugin()), /already registered/i);
});

test("plugin manager: unregisters a plugin", () => {
  const manager = new PluginManager();
  manager.register(makePlugin());

  assert.equal(manager.unregister("p1"), true);
  assert.equal(manager.unregister("p1"), false);
  assert.equal(manager.list().length, 0);
});

test("plugin manager: activates a plugin with a context", () => {
  const manager = new PluginManager();
  let received: PluginContext | undefined;
  manager.register(
    makePlugin({
      activate: (context) => {
        received = context;
      },
    }),
  );

  manager.activate("p1", makeContext());

  assert.ok(received);
  assert.equal(received?.diagram.database, "mysql");
  assert.deepEqual(manager.getActiveIds(), ["p1"]);
});

test("plugin manager: rejects when activating an unknown plugin", async () => {
  const manager = new PluginManager();
  await assert.rejects(() => manager.activate("nope", makeContext()), /not found/i);
});

test("plugin manager: activating twice does not re-activate", () => {
  const manager = new PluginManager();
  let calls = 0;
  manager.register(
    makePlugin({
      activate: () => {
        calls += 1;
      },
    }),
  );

  manager.activate("p1", makeContext());
  manager.activate("p1", makeContext());

  assert.equal(calls, 1);
});

test("plugin manager: deactivates a plugin", () => {
  const manager = new PluginManager();
  let calls = 0;
  manager.register(
    makePlugin({
      deactivate: () => {
        calls += 1;
      },
    }),
  );

  manager.activate("p1", makeContext());
  manager.deactivate("p1");

  assert.equal(calls, 1);
  assert.deepEqual(manager.getActiveIds(), []);
});

test("plugin manager: deactivating an inactive plugin is a no-op", () => {
  const manager = new PluginManager();
  manager.register(makePlugin());

  manager.deactivate("p1");

  assert.deepEqual(manager.getActiveIds(), []);
});

test("plugin manager: activateAll activates every registered plugin", async () => {
  const manager = new PluginManager();
  const activated: string[] = [];
  manager.register(
    makePlugin({
      id: "p1",
      activate: () => {
        activated.push("p1");
      },
    }),
  );
  manager.register(
    makePlugin({
      id: "p2",
      activate: () => {
        activated.push("p2");
      },
    }),
  );

  const result = await manager.activateAll(makeContext());

  assert.deepEqual(activated, ["p1", "p2"]);
  assert.deepEqual(result.activated, ["p1", "p2"]);
  assert.deepEqual(result.failed, []);
});

test("plugin manager: deactivateAll deactivates every active plugin", async () => {
  const manager = new PluginManager();
  const deactivated: string[] = [];
  manager.register(
    makePlugin({
      id: "p1",
      deactivate: () => {
        deactivated.push("p1");
      },
    }),
  );
  manager.register(
    makePlugin({
      id: "p2",
      deactivate: () => {
        deactivated.push("p2");
      },
    }),
  );

  await manager.activateAll(makeContext());
  await manager.deactivateAll();

  assert.deepEqual(deactivated, ["p1", "p2"]);
  assert.deepEqual(manager.getActiveIds(), []);
});

test("plugin manager: a plugin can contribute extensions", () => {
  const manager = new PluginManager();
  manager.register(
    makePlugin({
      activate: (context) => {
        context.registerExtension({
          id: "p1.toolbar",
          point: "toolbar",
          priority: 10,
          handler: () => "hello",
        });
      },
    }),
  );

  manager.activate("p1", makeContext());

  const extensions = manager.getExtensions<() => string>("toolbar");
  assert.equal(extensions.length, 1);
  assert.equal(extensions[0].id, "p1.toolbar");
  assert.equal(extensions[0].handler(), "hello");
});

test("plugin manager: extensions are ordered by priority", () => {
  const manager = new PluginManager();
  manager.registerExtension({
    id: "low",
    point: "toolbar",
    priority: 1,
    handler: () => "low",
  });
  manager.registerExtension({
    id: "high",
    point: "toolbar",
    priority: 100,
    handler: () => "high",
  });

  assert.deepEqual(
    manager.getExtensions("toolbar").map((extension) => extension.id),
    ["high", "low"],
  );
});

test("plugin manager: extensions are scoped per extension point", () => {
  const manager = new PluginManager();
  manager.registerExtension({
    id: "a",
    point: "toolbar",
    handler: () => "a",
  });
  manager.registerExtension({
    id: "b",
    point: "context-menu",
    handler: () => "b",
  });

  assert.equal(manager.getExtensions("toolbar").length, 1);
  assert.equal(manager.getExtensions("context-menu").length, 1);
});

test("plugin manager: deactivating a plugin removes its extensions", () => {
  const manager = new PluginManager();
  manager.register(
    makePlugin({
      activate: (context) => {
        context.registerExtension({
          id: "p1.toolbar",
          point: "toolbar",
          handler: () => "hello",
        });
      },
    }),
  );

  manager.activate("p1", makeContext());
  assert.equal(manager.getExtensions("toolbar").length, 1);

  manager.deactivate("p1");
  assert.equal(manager.getExtensions("toolbar").length, 0);
});

test("plugin manager: a failing plugin does not stop the other plugins", async () => {
  const manager = new PluginManager();
  manager.register(
    makePlugin({
      id: "broken",
      activate: () => {
        throw new Error("boom");
      },
    }),
  );
  let healthy = false;
  manager.register(
    makePlugin({
      id: "healthy",
      activate: () => {
        healthy = true;
      },
    }),
  );

  await manager.activateAll(makeContext());

  assert.equal(healthy, true);
  assert.deepEqual(manager.getActiveIds(), ["healthy"]);
});

test("plugin manager: exposes the host store through the context", () => {
  const manager = new PluginManager();
  let store: unknown;
  manager.register(
    makePlugin({
      activate: (context) => {
        store = context.getStore("diagram");
      },
    }),
  );

  const diagram = createEmptyDiagram({ database: "postgres" });
  manager.activate("p1", {
    diagram,
    metadata: new MetadataRegistry(),
    registerExtension: () => {},
    getStore: ((id: string) =>
      id === "diagram" ? diagram : undefined) as PluginContext["getStore"],
  });

  assert.equal((store as { database: string }).database, "postgres");
});
