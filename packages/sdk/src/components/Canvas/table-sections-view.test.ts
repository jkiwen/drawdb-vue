import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import Table from "./Table.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

/**
 * The description block of a table edits the text of the layer that is shown.
 *
 * The block reads the logical description in the logical layer and the
 * physical comment in the physical layer, so it must write the same one back.
 * Writing the comment while showing the logical description would swallow the
 * edit, and the block would keep showing the old text.
 */

function seed(pinia: Pinia) {
  setActivePinia(pinia);
  const diagram = useDiagramStore(pinia);

  diagram.addTable({
    id: "users",
    name: "users",
    x: 40,
    y: 60,
    comment: "physical note",
    logical: {
      id: "l_users",
      name: "user",
      description: "A person who can sign in.",
      attributes: [
        { id: "a_users_id", name: "id", logicalType: { family: "integer" }, fieldId: "users_id" },
      ],
    },
    fields: [
      {
        id: "users_id",
        name: "id",
        fieldType: { type: "INTEGER" },
        fieldTypeSource: "explicit",
        notNull: true,
      },
    ],
    primaryKey: { id: "pk_users", name: "PK_users", logicalName: "PK_users", columns: [{ fieldId: "users_id" }] },
  });

  return diagram;
}

function freshPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

function showDescription(pinia: Pinia, layer: "logical" | "physical"): void {
  const diagram = useDiagramStore(pinia);
  diagram.updateViewState({
    viewLayer: layer,
    displayMode: "all",
    toggles: { description: true, fields: true, pkUkFk: true, indexes: true },
  });
}

function mountTable(pinia: Pinia) {
  const diagram = useDiagramStore(pinia);
  return mount(Table, {
    props: { table: diagram.tableById("users")! },
    global: { plugins: [pinia, naive] },
  });
}

function fire(element: Element, type: string): void {
  element.dispatchEvent(
    new window.MouseEvent(type, { bubbles: true, cancelable: true }),
  );
}

async function editDescription(wrapper: ReturnType<typeof mountTable>, value: string): Promise<void> {
  const text = wrapper.find('[data-testid="table-comment-users"]');
  assert.ok(text.exists(), "the description block is drawn");
  fire(text.element, "dblclick");
  await nextTick();
  const html = wrapper.html();
  const start = html.indexOf("ddb-table__sections");
  assert.ok(
    start >= 0,
    `the sections are drawn: ${html.slice(0, 400)}`,
  );
  assert.ok(
    html.includes("table-comment-input"),
    `the block turns into an input: ${html.slice(start, start + 600)}`,
  );
  const node = wrapper.find('[data-testid="table-comment-input-users"]');
  assert.ok(node.exists(), "the block turns into an input node");
  // NInput forwards `data-testid` to its wrapper and keeps the real input
  // inside it; a bare input carries the test id on itself.
  const inner = node.find("input, textarea");
  const el = (inner.exists() ? inner.element : node.element) as HTMLInputElement;
  el.focus();
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
  el.dispatchEvent(new window.Event("blur", { bubbles: false }));
  await nextTick();
}

describe("the description block of a table", () => {
  it("shows the logical description in the logical layer", async () => {
    const pinia = freshPinia();
    seed(pinia);
    showDescription(pinia, "logical");
    const wrapper = mountTable(pinia);

    const text = wrapper.find('[data-testid="table-comment-users"]');
    assert.equal(text.text(), "A person who can sign in.");
  });

  it("keeps the logical description read-only on the canvas", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    showDescription(pinia, "logical");
    const wrapper = mountTable(pinia);

    const text = wrapper.find('[data-testid="table-comment-users"]');
    fire(text.element, "dblclick");
    await nextTick();

    assert.equal(
      wrapper.html().includes("table-comment-input"),
      false,
      "the logical layer is edited in the edit panel, not on the canvas",
    );
    assert.equal(
      diagram.tableById("users")!.logical.description,
      "A person who can sign in.",
    );
  });

  it("writes the comment back in the physical layer", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    showDescription(pinia, "physical");
    const wrapper = mountTable(pinia);

    await editDescription(wrapper, "a physical note");

    const table = diagram.tableById("users")!;
    assert.equal(table.comment, "a physical note");
    assert.equal(
      table.logical.description,
      "A person who can sign in.",
      "the logical description is untouched",
    );
  });
describe("a key row of a table", () => {
  it("selects the field of the primary key when it is clicked (issue 5)", async () => {
    const pinia = freshPinia();
    seed(pinia);
    showDescription(pinia, "physical");
    const wrapper = mountTable(pinia);
    const row = wrapper.find('[data-testid="table-section-primary-line-users-0"]');
    assert.ok(row.exists(), "the primary key row is pickable");
    await row.trigger("click");
    const ui = useUIStore(pinia);
    assert.deepEqual(ui.selectedFields, [{ tableId: "users", fieldId: "users_id" }]);
  });

  it("selects the relationship of a foreign key when it is clicked", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.addTable({
      id: "orgs",
      name: "organisations",
      x: 400,
      y: 60,
      fields: [
        { id: "orgs_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
      ],
      logical: { id: "l_orgs", name: "organisation", attributes: [] },
    });
    diagram
      .addRelationship({
        id: "r1",
        name: "fk_users_org",
        startTableId: "users",
        startFieldId: "users_id",
        endTableId: "orgs",
        endFieldId: "orgs_id",
      });
    showDescription(pinia, "physical");
    const wrapper = mountTable(pinia);
    const row = wrapper.find('[data-testid="table-section-foreign-line-users-0"]');
    assert.ok(row.exists(), "the foreign key row is pickable");
    await row.trigger("click");
    const ui = useUIStore(pinia);
    assert.deepEqual(ui.selectedRelationshipIds, ["r1"]);
  });
});});
