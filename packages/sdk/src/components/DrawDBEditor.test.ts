import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import DrawDBEditor from "./DrawDBEditor.vue";
import { useDiagramStore } from "../stores/diagram.ts";
import { useUIStore } from "../stores/ui.ts";
import { useSaveStore } from "../stores/save.ts";
import { useViewStateStore } from "../stores/view-state.ts";
import { useSettingsStore } from "../stores/settings.ts";
import { MemoryStorageAdapter } from "@drawdb/core";
import type { Diagram } from "@drawdb/core";
import { getLocale } from "../i18n/index.ts";
import { naive } from "../../../../scripts/naive-ui-mock.mjs";

// The editor owns timers and plugins, so every wrapper is unmounted again.
enableAutoUnmount(afterEach);

/**
 * The parts of the editor the host application can call.
 *
 * The single file components are declared generically for the type check, so
 * the exposed methods are described here.
 */
interface EditorInstance {
  save(): Promise<void>;
  exportSql(): string;
  exportDbml(): string;
  importSql(sql: string, database?: string): Diagram;
  runCommand(key: string): boolean;
}

function diagramFixture(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "mysql",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        logical: {
          id: "l_t1",
          name: "users",
          attributes: [
            { id: "a_f1", name: "id", logicalType: { family: "integer" }, fieldId: "f1" },
          ],
        },
        fields: [
          { id: "f1", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true },
        ],
      },
    ],
    relationships: [],
    notes: [],
    subjectAreas: [],
    types: [],
    enums: [],
    views: [],
    metadata: {},
  };
}

describe("DrawDBEditor", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  /**
   * Mounts the editor.
   *
   * The pinia is installed as a plugin of the application, so that the
   * components of the tree find it through the injection.
   */
  function mountEditor(props: Record<string, unknown> = {}) {
    return mount(DrawDBEditor, {
      props,
      global: { plugins: [pinia, naive] },
    });
  }

  it("renders the canvas and the outline tree", () => {
    const wrapper = mountEditor();
    assert.ok(wrapper.find('[data-testid="canvas"]').exists());
    assert.ok(wrapper.find('[data-testid="outline-tree"]').exists());
  });

  it("renders the header", () => {
    const wrapper = mountEditor();
    assert.ok(wrapper.find('[data-testid="header"]').exists());
  });

  it("follows the locale of the host application", async () => {
    const wrapper = mountEditor({ locale: "zh-CN" });
    assert.equal(getLocale(), "zh-CN");
    await wrapper.setProps({ locale: "en" });
    assert.equal(getLocale(), "en");
  });

  it("applies the initial value in the uncontrolled mode", () => {
    mountEditor({ initialValue: diagramFixture() });
    assert.equal(useDiagramStore().diagram.title, "shop");
    assert.equal(useDiagramStore().tables.length, 1);
  });

  it("applies the model value in the controlled mode", () => {
    mountEditor({ modelValue: diagramFixture() });
    assert.equal(useDiagramStore().tables.length, 1);
  });

  it("emits update:modelValue and change when the diagram changes", async () => {
    const wrapper = mountEditor({ modelValue: diagramFixture() });
    useDiagramStore().updateTable("t1", { name: "customers" });
    await nextTick();
    const events = wrapper.emitted("update:modelValue");
    assert.ok(events && events.length > 0);
    const diagram = events[events.length - 1][0] as Diagram;
    assert.equal(diagram.tables[0].name, "customers");
    assert.ok(wrapper.emitted("change"));
  });

  it("keeps the history when the parent sends the emitted diagram back", async () => {
    const wrapper = mountEditor({ modelValue: diagramFixture() });
    useDiagramStore().updateTable("t1", { name: "customers" });
    await nextTick();
    const emitted = wrapper.emitted("update:modelValue")![0][0] as Diagram;
    await wrapper.setProps({ modelValue: emitted });
    assert.equal(useDiagramStore().tables[0].name, "customers");
  });

  it("hides the outline tree in the readonly mode", () => {
    const wrapper = mountEditor({ readonly: true });
    assert.ok(!wrapper.find('[data-testid="outline-tree"]').exists());
  });

  it("saves the diagram with the storage adapter and emits save", async () => {
    const adapter = new MemoryStorageAdapter();
    const wrapper = mountEditor({ storage: adapter });
    await (wrapper.vm as unknown as EditorInstance).save();
    assert.equal(useSaveStore().state, "saved");
    assert.ok(wrapper.emitted("save"));
    const stored = await adapter.list();
    assert.equal(stored.length, 1);
  });

  it("auto saves when the interval elapses", async () => {
    const adapter = new MemoryStorageAdapter();
    mountEditor({
      storage: adapter,
      autoSave: true,
      autoSaveInterval: 10,
      initialValue: diagramFixture(),
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    const stored = await adapter.list();
    assert.equal(stored.length, 1);
  });

  it("activates the plugins and gives them the stores", async () => {
    let context: any;
    const plugin = {
      id: "demo",
      name: "Demo",
      version: "1.0.0",
      activate(ctx: any) {
        context = ctx;
      },
    };
    mountEditor({ plugins: [plugin] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(context);
    assert.ok(context.diagramStore);
    assert.ok(context.ui);
    assert.ok(context.history);
  });

  it("runs a command that a plugin registered", async () => {
    let ran = false;
    const plugin = {
      id: "demo",
      name: "Demo",
      version: "1.0.0",
      activate(context: any) {
        context.registerCommand("demo:run", () => {
          ran = true;
        });
      },
    };
    const wrapper = mountEditor({ plugins: [plugin] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    (wrapper.vm as unknown as EditorInstance).runCommand("demo:run");
    assert.equal(ran, true);
  });

  it("exports the SQL of the diagram", () => {
    const wrapper = mountEditor({ initialValue: diagramFixture() });
    const sql = (wrapper.vm as unknown as EditorInstance).exportSql();
    assert.ok(sql.includes("CREATE TABLE"));
    assert.ok(sql.includes("users"));
  });

  it("imports SQL into the diagram", () => {
    const wrapper = mountEditor();
    (wrapper.vm as unknown as EditorInstance).importSql(
      "CREATE TABLE products (id INTEGER PRIMARY KEY, name VARCHAR(20));",
      "mysql",
    );
    assert.equal(useDiagramStore().tables.length, 1);
    assert.equal(useDiagramStore().tables[0].name, "products");
  });

  it("changes the database of the diagram", async () => {
    const wrapper = mountEditor({ initialValue: diagramFixture() });
    await wrapper.setProps({ database: "postgres" });
    assert.equal(useDiagramStore().diagram.database, "postgres");
  });

  it("collapses the side panel instead of unmounting it (Q21)", async () => {
    const wrapper = mountEditor();
    assert.equal(useUIStore().sidebarOpen, true);

    useUIStore().toggleSidebar(false);
    await nextTick();

    const panel = wrapper.find('[data-side="left"]');
    assert.ok(panel.exists(), "the panel stays in the layout");
    assert.equal(panel.attributes("aria-hidden"), "true");
    assert.equal(useSettingsStore().settings.panelLeftCollapsed, true);
    assert.equal(
      wrapper.find('[data-testid="outline-tree"]').exists(),
      true,
      "the outline keeps its state while the panel is collapsed",
    );

    // The preference is persisted, so the test restores it for the specs that
    // share this process.
    useUIStore().toggleSidebar(true);
    assert.equal(useSettingsStore().settings.panelLeftCollapsed, false);
  });

  it("follows the viewMode prop", async () => {
    const wrapper = mountEditor({ viewMode: "logical" });
    assert.equal(useViewStateStore().viewLayer, "logical");
    await wrapper.setProps({ viewMode: "physical" });
    assert.equal(useViewStateStore().viewLayer, "physical");
  });
});
