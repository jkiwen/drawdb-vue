import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
import RelationshipDialog from "./RelationshipDialog.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import type { Diagram } from "@drawdb/core";

/** The dialog that creates a relationship between two tables. */

function seed(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "postgres",
    tables: [
      {
        id: "users",
        name: "users",
        x: 0,
        y: 0,
        logical: {
          id: "l_users",
          name: "users",
          attributes: [
            { id: "a_users_id", name: "id", logicalType: { family: "integer" }, fieldId: "users_id" },
            { id: "a_users_email", name: "email", logicalType: { family: "string" }, fieldId: "users_email" },
          ],
        },
        fields: [
          { id: "users_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true },
          { id: "users_email", name: "email", fieldType: { type: "VARCHAR", length: 255 }, fieldTypeSource: "explicit" },
        ],
      },
      {
        id: "posts",
        name: "posts",
        x: 300,
        y: 0,
        logical: {
          id: "l_posts",
          name: "posts",
          attributes: [
            { id: "a_posts_id", name: "id", logicalType: { family: "integer" }, fieldId: "posts_id" },
            { id: "a_posts_user_id", name: "user_id", logicalType: { family: "integer" }, fieldId: "posts_user_id" },
          ],
        },
        fields: [
          { id: "posts_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true },
          { id: "posts_user_id", name: "user_id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
        ],
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

function setup(diagram: Diagram) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useDiagramStore(pinia);
  store.setDiagram(diagram);
  return store;
}

function mountDialog(props: Record<string, unknown>) {
  return mount(RelationshipDialog, {
    props: props as never,
    global: { plugins: [naive] },
  });
}

/** Picks an option of a select of the dialog. */
async function select(
  wrapper: ReturnType<typeof mountDialog>,
  testid: string,
  value: string,
): Promise<void> {
  const element = wrapper.find(`[data-testid="${testid}"]`);
  assert.ok(element.exists(), `${testid} should exist`);
  const el = element.element as HTMLSelectElement;
  el.value = value;
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
  await nextTick();
}

describe("RelationshipDialog", () => {
  it("creates a relationship between the two tables", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog({ open: true });
    await nextTick();

    // The dialog starts with the first two tables of the diagram.
    await select(wrapper, "relationship-start-table", "posts");
    await select(wrapper, "relationship-end-table", "users");
    await select(wrapper, "relationship-end-field", "users_id");
    await wrapper.find('[data-testid="relationship-create"]').trigger("click");
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    const relationship = diagram.relationships[0];
    assert.equal(relationship.startTableId, "posts");
    assert.equal(relationship.endTableId, "users");
    assert.equal(relationship.endFieldId, "users_id");
  });

  it("links a table alone to the primary key of the other table", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog({ open: true });
    await nextTick();

    await select(wrapper, "relationship-start-table", "posts");
    await select(wrapper, "relationship-end-table", "users");
    // The field of the target stays empty, so the end is the table itself.
    await wrapper.find('[data-testid="relationship-create"]').trigger("click");
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].endFieldId, "users_id");
  });

  it("names the relationship after the field it starts at", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog({ open: true });
    await nextTick();

    await select(wrapper, "relationship-start-table", "posts");
    await select(wrapper, "relationship-start-field", "posts_user_id");
    await select(wrapper, "relationship-end-table", "users");
    await wrapper.find('[data-testid="relationship-create"]').trigger("click");
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].name, "fk_posts_user_id_users");
  });

  it("keeps the name the user writes", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog({ open: true });
    await nextTick();

    const name = wrapper.find('[data-testid="relationship-name"]');
    assert.ok(name.exists(), "the dialog has a name field");
    const el = name.element as HTMLInputElement;
    el.value = "posts_to_users";
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
    await nextTick();

    await select(wrapper, "relationship-start-table", "posts");
    await select(wrapper, "relationship-end-table", "users");
    await wrapper.find('[data-testid="relationship-create"]').trigger("click");
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].name, "posts_to_users");
  });

  it("links a table without a primary key to its first field", async () => {
    const diagram = setup(seed());
    diagram.addTable({
      id: "logs",
      name: "logs",
      x: 600,
      y: 0,
      logical: {
        id: "l_logs",
        name: "logs",
        attributes: [
          { id: "a_logs_message", name: "message", logicalType: { family: "text" }, fieldId: "logs_message" },
        ],
      },
      fields: [
        { id: "logs_message", name: "message", fieldType: { type: "TEXT" }, fieldTypeSource: "explicit" },
      ],
    });
    const wrapper = mountDialog({ open: true });
    await nextTick();

    await select(wrapper, "relationship-start-table", "posts");
    await select(wrapper, "relationship-end-table", "logs");
    await wrapper.find('[data-testid="relationship-create"]').trigger("click");
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    assert.equal(diagram.relationships[0].endTableId, "logs");
    assert.equal(diagram.relationships[0].endFieldId, "logs_message");
  });

  it("refuses a relationship between one table and itself", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog({ open: true });
    await nextTick();

    await select(wrapper, "relationship-start-table", "users");
    await select(wrapper, "relationship-end-table", "users");
    await select(wrapper, "relationship-start-field", "users_id");
    await select(wrapper, "relationship-end-field", "users_id");
    await nextTick();

    assert.ok(
      wrapper.find('[data-testid="relationship-reason"]').exists(),
      "the dialog says why it cannot create the relationship",
    );
    await wrapper.find('[data-testid="relationship-create"]').trigger("click");
    await nextTick();
    assert.equal(diagram.relationships.length, 0);
  });

  it("refuses a relationship that has no table at one end", async () => {
    const diagram = setup(seed());
    const wrapper = mountDialog({ open: true });
    await nextTick();

    await select(wrapper, "relationship-start-table", "posts");
    await select(wrapper, "relationship-end-table", "");
    await nextTick();

    assert.ok(
      wrapper.find('[data-testid="relationship-reason"]').exists(),
      "the dialog says that a table is missing",
    );
    await wrapper.find('[data-testid="relationship-create"]').trigger("click");
    await nextTick();
    assert.equal(diagram.relationships.length, 0);
  });

  it("undoes the relationship it created", async () => {
    const diagram = setup(seed());
    const history = useHistoryStore();
    const wrapper = mountDialog({ open: true });
    await nextTick();

    await select(wrapper, "relationship-start-table", "posts");
    await select(wrapper, "relationship-end-table", "users");
    await wrapper.find('[data-testid="relationship-create"]').trigger("click");
    await nextTick();

    assert.equal(diagram.relationships.length, 1);
    history.undo();
    await nextTick();
    assert.equal(diagram.relationships.length, 0);
  });

  it("shows nothing when it is closed", async () => {
    setup(seed());
    const wrapper = mountDialog({ open: false });
    await nextTick();
    assert.equal(wrapper.find('[data-testid="relationship-dialog"]').exists(), false);
  });
});
