import { createNote, type SDKPlugin } from "@drawdb/vue-sdk";

/** The key of the command the demo plugin registers. */
export const DEMO_ADD_NOTE_COMMAND = "demo.add-note";

/**
 * A small plugin that shows how a host application extends the editor.
 *
 * The plugin contributes one command, which the host application can run
 * through the editor of the SDK. The command adds a note to the diagram, so
 * that a test can assert that the plugin was activated and that the command
 * was routed to it.
 */
export const demoPlugin: SDKPlugin = {
  id: "demo-plugin",
  name: "Demo plugin",
  version: "1.0.0",
  description: "Adds a note to the diagram with a command of the host application.",
  activate(context) {
    context.registerCommand(DEMO_ADD_NOTE_COMMAND, () => {
      const store = context.diagramStore;
      const note = createNote(
        { x: 100 + store.notes.length * 260, y: 100 },
        "Added by the demo plugin.",
      );
      store.addEntity("notes", note);
    });
  },
};

/** The plugins the application hands to the editor of the SDK. */
export const demoPlugins: SDKPlugin[] = [demoPlugin];
