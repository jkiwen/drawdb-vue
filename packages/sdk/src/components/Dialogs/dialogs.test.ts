import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
import SqlPreviewDialog from "./SqlPreviewDialog.vue";
import ImportDialog from "./ImportDialog.vue";
import AutoRelationshipsDialog from "./AutoRelationshipsDialog.vue";
import EditorDialogs from "../EditorDialogs.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useSaveStore } from "../../stores/save.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { useDialogStore } from "../../stores/dialogs.ts";
import { useEditorCommands } from "../../composables/use-editor-commands.ts";
import { DEFAULT_MENU_GROUPS } from "../Header/types.ts";
import { inferRelationships } from "@drawdb/core";
import type { Diagram } from "@drawdb/core";

/** The dialogs of the editor: the preview, the import and the inference. */

/** A small ERWin 7 Standard File: two attributes, two fields and an unknown element. */
const ERWIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ERwin FileVersion="7.3.1822" Format="ERwin" xmlns="http://www.ca.com/erwin">
<EMX:Model>
  <Entity id="{E1}+00000000" name="Customer">
    <EntityProps>
      <Name>Customer</Name>
      <Physical_Name>customers</Physical_Name>
    </EntityProps>
    <Attribute_Groups>
      <Attribute id="{A1}+00000000" name="Customer id">
        <AttributeProps>
          <Name>Customer id</Name>
          <Physical_Name>customer_id</Physical_Name>
          <Physical_Data_Type>INT(4)</Physical_Data_Type>
          <Null_Option_Type>1</Null_Option_Type>
        </AttributeProps>
      </Attribute>
      <Attribute id="{A2}+00000000" name="Email">
        <AttributeProps>
          <Name>Email</Name>
          <Physical_Name>email</Physical_Name>
          <Physical_Data_Type>VARCHAR2(120)</Physical_Data_Type>
          <Null_Option_Type>0</Null_Option_Type>
        </AttributeProps>
      </Attribute>
    </Attribute_Groups>
    <Key_Group_Groups>
      <Key_Group id="{K1}+00000000" name="PK_customers">
        <Key_GroupProps>
          <Name>PK_customers</Name>
          <Key_Group_Type>PK</Key_Group_Type>
          <Is_Unique>true</Is_Unique>
          <Key_Group_Members_Order_Ref_Array>
            <Key_Group_Members_Order_Ref index="0">{M1}+00000000</Key_Group_Members_Order_Ref>
          </Key_Group_Members_Order_Ref_Array>
        </Key_GroupProps>
        <Key_Group_Member_Groups>
          <Key_Group_Member id="{M1}+00000000" name="Customer id">
            <Key_Group_MemberProps>
              <Attribute_Ref>{A1}+00000000</Attribute_Ref>
              <Key_Group_Sort_Order>ASC</Key_Group_Sort_Order>
            </Key_Group_MemberProps>
          </Key_Group_Member>
        </Key_Group_Member_Groups>
      </Key_Group>
    </Key_Group_Groups>
  </Entity>
</EMX:Model>
</ERwin>`;

function seed(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "postgres",
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
            { id: "a_f2", name: "email", logicalType: { family: "string" }, fieldId: "f2" },
          ],
        },
        fields: [
          { id: "f1", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
          { id: "f2", name: "email", fieldType: { type: "VARCHAR", length: 255 }, fieldTypeSource: "explicit" },
        ],
        primaryKey: { id: "pk_users", name: "PK_users", logicalName: "PK_users", columns: [{ fieldId: "f1" }] },
      },
    ],
    relationships: [],
    notes: [],
    areas: [],
    subjectAreas: [],
    types: [],
    enums: [],
    views: [],
    sqlHeader: "",
    metadata: {},
  } as Diagram;
}

/** A second table with the field that looks like a foreign key of the first. */
function seedWithChild(): Diagram {
  const diagram = seed();
  diagram.tables.push({
    id: "t2",
    name: "orders",
    x: 300,
    y: 0,
    logical: {
      id: "l_t2",
      name: "orders",
      attributes: [
        { id: "a_f3", name: "id", logicalType: { family: "integer" }, fieldId: "f3" },
        { id: "a_f4", name: "user_id", logicalType: { family: "integer" }, fieldId: "f4" },
      ],
    },
    fields: [
      { id: "f3", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
      { id: "f4", name: "user_id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
    ],
    primaryKey: { id: "pk_orders", name: "PK_orders", logicalName: "PK_orders", columns: [{ fieldId: "f3" }] },
  });
  return diagram;
}

function setup(diagram: Diagram) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useDiagramStore(pinia);
  store.setDiagram(diagram);
  return store;
}

function mountDialog(component: unknown, props: Record<string, unknown>) {
  return mount(component as never, { props: props as never, global: { plugins: [naive] } });
}

/** Types into the field of a dialog and lets the dialog see the event. */
function setValue(wrapper: ReturnType<typeof mount>, testid: string, value: string): void {
  const field = wrapper.find(`[data-testid="${testid}"]`);
  assert.ok(field.exists(), `${testid} should exist`);
  const el = field.element as HTMLTextAreaElement | HTMLInputElement;
  (el as unknown as { focus(): void }).focus();
  (el as unknown as { value: string }).value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}

const SQL_SCRIPT = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email VARCHAR(255)
);`;

const DBML_SCRIPT = `Table users {
  id integer [primary key]
  email varchar(255)
}`;

describe("SqlPreviewDialog", () => {
  it("the sql preview shows the generated sql", async () => {
    setup(seed());
    const wrapper = mountDialog(SqlPreviewDialog, { open: true });
    await nextTick();
    assert.ok(wrapper.find('[data-testid="sql-preview-dialog"]').exists());
    const content = wrapper.find('[data-testid="sql-preview-content"]');
    assert.ok(content.exists(), "the preview shows its content");
    assert.match(content.text(), /CREATE TABLE/);
  });

  it("the sql preview can switch to dbml", async () => {
    setup(seed());
    const wrapper = mountDialog(SqlPreviewDialog, { open: true });
    await nextTick();
    await wrapper.find('[data-testid="sql-preview-format-dbml"]').trigger("click");
    await nextTick();
    assert.match(wrapper.find('[data-testid="sql-preview-content"]').text(), /Table /);
  });

  it("the sql preview opens in the format the host asks for", async () => {
    setup(seed());
    const wrapper = mountDialog(SqlPreviewDialog, { open: true, format: "dbml" });
    await nextTick();
    assert.match(
      wrapper.find('[data-testid="sql-preview-content"]').text(),
      /Table /,
    );
  });

  it("the sql preview follows the format of the host", async () => {
    setup(seed());
    const wrapper = mountDialog(SqlPreviewDialog, { open: true });
    await nextTick();
    assert.match(
      wrapper.find('[data-testid="sql-preview-content"]').text(),
      /CREATE TABLE/,
    );
    await wrapper.setProps({ format: "dbml" } as never);
    await nextTick();
    assert.match(
      wrapper.find('[data-testid="sql-preview-content"]').text(),
      /Table /,
    );
  });

  it("the sql preview copies the sql to the clipboard", async () => {
    setup(seed());
    const written: string[] = [];
    const original = globalThis.navigator?.clipboard;
    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: (text: string) => {
            written.push(text);
            return Promise.resolve();
          },
        },
      },
      configurable: true,
      writable: true,
    });
    try {
      const wrapper = mountDialog(SqlPreviewDialog, { open: true });
      await nextTick();
      await wrapper.find('[data-testid="sql-preview-copy"]').trigger("click");
      await nextTick();
      assert.equal(written.length, 1);
      assert.match(written[0], /CREATE TABLE/);
      assert.ok(wrapper.find('[data-testid="sql-preview-copied"]').exists());
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});

describe("ImportDialog", () => {
  it("the import dialog replaces the diagram when it is applied", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog(ImportDialog, { open: true, format: "sql" });
    await nextTick();
    setValue(wrapper, "import-input", SQL_SCRIPT);
    await nextTick();
    await wrapper.find('[data-testid="import-apply"]').trigger("click");
    await nextTick();
    await wrapper.find('[data-testid="import-confirm"]').trigger("click");
    await nextTick();
    // The SQL describes one table, so the diagram of the editor has it.
    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].name, "users");
    assert.ok(wrapper.find('[data-testid="import-success"]').exists());
  });

  it("the import dialog reports a parse error", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog(ImportDialog, { open: true, format: "sql" });
    await nextTick();
    setValue(wrapper, "import-input", "CREATE TABLE (;");
    await nextTick();
    await wrapper.find('[data-testid="import-apply"]').trigger("click");
    await nextTick();
    const error = wrapper.find('[data-testid="import-error"]');
    assert.ok(error.exists(), "the error is shown");
    assert.notEqual(error.text().trim(), "");
    // The diagram of the editor is untouched.
    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].name, "users");
  });

  it("the import dialog imports a dbml script", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog(ImportDialog, { open: true, format: "dbml" });
    await nextTick();
    setValue(wrapper, "import-input", DBML_SCRIPT);
    await nextTick();
    await wrapper.find('[data-testid="import-apply"]').trigger("click");
    await nextTick();
    await wrapper.find('[data-testid="import-confirm"]').trigger("click");
    await nextTick();
    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].fields.length, 2);
  });

  it("the import dialog reads an erwin file and shows what it read", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog(ImportDialog, { open: true, format: "erwin" });
    await nextTick();
    setValue(wrapper, "import-input", ERWIN_XML);
    await nextTick();
    await wrapper.find('[data-testid="import-apply"]').trigger("click");
    await nextTick();
    assert.equal(wrapper.find('[data-testid="import-report-version"]').text(), "7.3.1822");
    assert.equal(wrapper.find('[data-testid="import-report-entities"]').text(), "1");
    assert.equal(wrapper.find('[data-testid="import-report-attributes"]').text(), "2");
    assert.equal(wrapper.find('[data-testid="import-report-skipped"]').text(), "0");
    await wrapper.find('[data-testid="import-confirm"]').trigger("click");
    await nextTick();
    // The file describes one table, so the diagram of the editor has it.
    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].name, "customers");
    assert.equal(diagram.tables[0].fields[0].fieldTypeSource, "imported");
    assert.equal(diagram.diagram.invalidMarkers?.length, 0);
  });

  it("the import dialog imports a json diagram", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog(ImportDialog, { open: true, format: "json" });
    await nextTick();
    const source = JSON.stringify({
      id: "d2",
      title: "imported",
      database: "postgres",
      tables: [{ id: "a1", name: "articles", x: 0, y: 0, fields: [] }],
      relationships: [],
      notes: [],
      subjectAreas: [],
      types: [],
      enums: [],
      views: [],
    });
    setValue(wrapper, "import-input", source);
    await nextTick();
    await wrapper.find('[data-testid="import-apply"]').trigger("click");
    await nextTick();
    await wrapper.find('[data-testid="import-confirm"]').trigger("click");
    await nextTick();
    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].name, "articles");
  });

  it("the import dialog shows the format and the database it reads", async () => {
    setup(seed());
    const wrapper = mountDialog(ImportDialog, {
      open: true,
      format: "dbml",
      database: "postgres",
    });
    await nextTick();
    assert.equal(
      wrapper.find('[data-testid="import-format"]').text().trim(),
      "dbml",
    );
    assert.equal(
      wrapper.find('[data-testid="import-database"]').text().trim(),
      "postgres",
    );
  });

  it("the import dialog warns before it replaces the diagram", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog(ImportDialog, { open: true, format: "sql" });
    await nextTick();
    setValue(wrapper, "import-input", SQL_SCRIPT);
    await nextTick();
    await wrapper.find('[data-testid="import-apply"]').trigger("click");
    await nextTick();
    // The import is prepared before it is applied, so the diagram of the
    // editor is still the one it had.
    assert.equal(diagram.tables[0].name, "users");
    assert.ok(wrapper.find('[data-testid="import-confirm"]').exists());
  });
});

describe("AutoRelationshipsDialog", () => {
  it("the auto relationships dialog lists the candidates", async () => {
    setup(seedWithChild());
    const wrapper = mountDialog(AutoRelationshipsDialog, { open: true });
    await nextTick();
    assert.ok(wrapper.find('[data-testid="auto-relationships-dialog"]').exists());
    const list = wrapper.find('[data-testid="auto-relationships-list"]');
    assert.ok(list.exists(), "the candidates are listed");
    assert.match(list.text(), /user_id/);
    assert.match(list.text(), /users/);
  });

  it("the auto relationships dialog creates the selected relationships", async () => {
    const diagram = setup(seedWithChild());
    const wrapper = mountDialog(AutoRelationshipsDialog, { open: true });
    await nextTick();
    await wrapper.find('[data-testid="auto-relationship-pick"]').trigger("click");
    await nextTick();
    await wrapper.find('[data-testid="auto-relationships-apply"]').trigger("click");
    await nextTick();
    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].endTableId, "t1");
  });

  it("the auto relationships dialog shows an empty state", async () => {
    setup(seed());
    const wrapper = mountDialog(AutoRelationshipsDialog, { open: true });
    await nextTick();
    assert.ok(wrapper.find('[data-testid="auto-relationships-empty"]').exists());
  });
});

describe("Menu and store wiring", () => {
  it("the menu bar opens the dialogs of the file menu", () => {
    const file = DEFAULT_MENU_GROUPS.find((group) => group.key === "file");
    assert.ok(file, "the file group exists");
    assert.ok(
      file.items.some((item) => item.key === "import-json"),
      "the file group imports a diagram",
    );
    assert.ok(file.items.some((item) => item.key === "export-json"));
    assert.ok(file.items.some((item) => item.key === "export-png"));
    const edit = DEFAULT_MENU_GROUPS.find((group) => group.key === "edit");
    assert.ok(edit?.items.some((item) => item.key === "auto-layout"));
    assert.ok(edit?.items.some((item) => item.key === "auto-relationships"));
    const view = DEFAULT_MENU_GROUPS.find((group) => group.key === "view");
    assert.ok(view?.items.some((item) => item.key === "validate"));
  });

  it("the commands of the editor report the menu key that opens a dialog", () => {
    const diagram = useDiagramStore();
    const ui = useUIStore();
    const save = useSaveStore();
    const opened: string[] = [];
    const formats: (string | undefined)[] = [];
    const commands = useEditorCommands({
      diagramStore: diagram,
      uiStore: ui,
      saveStore: save,
      onSave: () => undefined,
      onExportSql: () => undefined,
      onExportDbml: () => undefined,
      onImportSql: () => undefined,
      onError: () => undefined,
      onOpenDialog: (key, options) => {
        opened.push(key);
        formats.push(options?.format);
      },
    });
    commands.onMenu("file:import-json");
    assert.deepEqual(opened, ["import"]);
    assert.deepEqual(formats, ["json"]);

    commands.onMenu("file:import-sql");
    assert.deepEqual(opened, ["import", "import"]);
    assert.deepEqual(formats, ["json", "sql"]);
  });

  it("the commands of the editor leave the entries of the host to it", () => {
    const diagram = useDiagramStore();
    const ui = useUIStore();
    const save = useSaveStore();
    const commands = useEditorCommands({
      diagramStore: diagram,
      uiStore: ui,
      saveStore: save,
      onSave: () => undefined,
      onExportSql: () => undefined,
      onExportDbml: () => undefined,
      onImportSql: () => undefined,
      onError: () => undefined,
    });
    assert.equal(commands.onMenu("file:new"), false);
    assert.equal(commands.onMenu("file:open"), false);
    assert.equal(commands.onMenu("help:documentation"), false);
    assert.equal(commands.onMenu("file:save"), true);
  });

  it("the commands of the editor export the JSON of the diagram", () => {
    const diagram = useDiagramStore();
    const ui = useUIStore();
    const save = useSaveStore();
    const exported: string[] = [];
    const commands = useEditorCommands({
      diagramStore: diagram,
      uiStore: ui,
      saveStore: save,
      onSave: () => undefined,
      onExportSql: () => undefined,
      onExportDbml: () => undefined,
      onImportSql: () => undefined,
      onError: () => undefined,
      onExportJson: (json) => exported.push(json),
    });
    commands.onMenu("file:export-json");
    assert.equal(exported.length, 1);
    const parsed = JSON.parse(exported[0]);
    assert.equal(typeof parsed, "object");
  });

  it("the store imports the inferred relationships and the layout", () => {
    const diagram = setup(seedWithChild());
    const candidates = inferRelationships(
      diagram.diagram.tables,
      diagram.diagram.relationships,
    );
    assert.equal(candidates.length, 1);
    diagram.applyRelationships(candidates);
    assert.equal(diagram.relationships.length, 1);

    const history = useHistoryStore();
    assert.ok(history.canUndo, "the batch is undoable as one entry");
    history.undo();
    assert.equal(diagram.relationships.length, 0);
  });

  it("the store arranges the tables and replaces the diagram on import", () => {
    const diagram = setup(seedWithChild());
    diagram.diagram.tables[1].x = 4000;
    diagram.autoArrange();
    assert.notEqual(diagram.tables[1].x, 4000);
    assert.ok(useHistoryStore().canUndo, "the layout is undoable");

    diagram.setImportedDiagram(seed());
    assert.equal(diagram.tables.length, 1);
    assert.equal(diagram.tables[0].name, "users");
  });
});

describe("EditorDialogs", () => {
  it("the dialogs are rendered from the state of the host", async () => {
    setup(seed());
    const wrapper = mount(EditorDialogs, {
      props: {
        sqlPreviewOpen: false,
        importOpen: true,
        autoRelationshipsOpen: false,
        imageExportOpen: false,
      },
      global: { plugins: [naive] },
    });
    await nextTick();
    // The import dialog is one of the dialogs the host opens.
    assert.ok(wrapper.find('[data-testid="import-dialog"]').exists());
  });

  it("the dialogs read the format and the database of the host", async () => {
    setup(seed());
    const wrapper = mount(EditorDialogs, {
      props: {
        importOpen: true,
        importFormat: "dbml",
        database: "postgres",
      },
      global: { plugins: [naive] },
    });
    await nextTick();
    assert.equal(
      wrapper.find('[data-testid="import-format"]').text().trim(),
      "dbml",
    );
    assert.equal(
      wrapper.find('[data-testid="import-database"]').text().trim(),
      "postgres",
    );
  });
});

describe("the entry of the menu that adds a relationship", () => {
  it("the editor answers the key itself instead of the host", () => {
    setup(seedWithChild());
    const diagram = useDiagramStore();
    const ui = useUIStore();
    const save = useSaveStore();
    const opened: string[] = [];
    const commands = useEditorCommands({
      diagramStore: diagram,
      uiStore: ui,
      saveStore: save,
      onSave: () => undefined,
      onExportSql: () => undefined,
      onExportDbml: () => undefined,
      onImportSql: () => undefined,
      onError: () => undefined,
      onOpenDialog: (key) => {
        opened.push(key);
      },
    });

    // The key is the one the menu bar sends for the entry of the header.
    assert.equal(commands.onMenu("edit:add-relationship"), true);
    assert.deepEqual(opened, ["relationship"]);
  });

  it("the dialog of the relationship opens and creates the relationship", async () => {
    const diagram = setup(seedWithChild());
    const dialogs = useDialogStore();
    const wrapper = mount(EditorDialogs, {
      props: {
        relationshipOpen: dialogs.relationshipOpen,
      },
      global: { plugins: [naive] },
    });
    await nextTick();

    // The dialog is closed at first.
    assert.equal(wrapper.find('[data-testid="relationship-dialog"]').exists(), false);

    // The store opens it, the way the menu entry does.
    dialogs.open("relationship");
    await wrapper.setProps({ relationshipOpen: dialogs.relationshipOpen });
    await nextTick();
    assert.ok(wrapper.find('[data-testid="relationship-dialog"]').exists());

    // The dialog starts with the two tables of the diagram, and creates the
    // relationship between them.
    await wrapper
      .find('[data-testid="relationship-create"]')
      .trigger("click");
    await nextTick();
    assert.equal(diagram.relationships.length, 1);
  });
});
