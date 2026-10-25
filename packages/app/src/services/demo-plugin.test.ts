import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "@drawdb/core";
import type { SDKPluginContext } from "@drawdb/vue-sdk";
import { DEMO_ADD_NOTE_COMMAND, demoPlugin } from "./demo-plugin.ts";

/**
 * A context that records the commands the plugin registers.
 *
 * The plugin only needs the command registry and the diagram store, so the
 * test hands it the two of them and nothing else.
 */
function makeContext() {
  const commands = new Map<string, () => void>();
  const notes: unknown[] = [];

  const context = {
    registerCommand: (key: string, handler: () => void) => {
      commands.set(key, handler);
    },
    diagramStore: {
      get notes() {
        return notes;
      },
      addEntity: (collection: string, entity: unknown) => {
        if (collection === "notes") notes.push(entity);
      },
    },
  } as unknown as SDKPluginContext;

  return { context, commands, notes };
}

test("the demo plugin registers the command of the host application", async () => {
  const { context, commands } = makeContext();

  await demoPlugin.activate(context);

  assert.equal(demoPlugin.id, "demo-plugin");
  assert.ok(commands.has(DEMO_ADD_NOTE_COMMAND));
});

test("the command of the demo plugin adds a note to the diagram", async () => {
  const { context, commands, notes } = makeContext();

  await demoPlugin.activate(context);
  commands.get(DEMO_ADD_NOTE_COMMAND)?.();

  assert.equal(notes.length, 1);
  assert.equal((notes[0] as { title: string }).title, "Note");
  assert.equal(
    (notes[0] as { content: string }).content,
    "Added by the demo plugin.",
  );
});

test("every run of the command adds another note", async () => {
  const { context, commands, notes } = makeContext();

  await demoPlugin.activate(context);
  commands.get(DEMO_ADD_NOTE_COMMAND)?.();
  commands.get(DEMO_ADD_NOTE_COMMAND)?.();

  assert.equal(notes.length, 2);
  assert.notEqual(
    (notes[0] as { id: unknown }).id,
    (notes[1] as { id: unknown }).id,
  );
});

test("the note of the demo plugin fits into the diagram of the core", async () => {
  const { context, commands, notes } = makeContext();
  const diagram = createEmptyDiagram({ id: "d1", title: "Billing" });

  await demoPlugin.activate(context);
  commands.get(DEMO_ADD_NOTE_COMMAND)?.();
  diagram.notes.push(notes[0] as never);

  assert.equal(diagram.notes.length, 1);
});
