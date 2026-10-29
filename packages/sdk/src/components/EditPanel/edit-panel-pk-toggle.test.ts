import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import type { Diagram, Table } from "@drawdb/core";
import EditPanel from "./EditPanel.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";

/**
 * The primary key toggle of a field card: a column joins the primary key
 * straight from the card, without going through the constraints group.
 */
function sampleDiagram(): Diagram {
  const diagram = createEmptyDiagram();
  const users = createTable({ id: "t_users", name: "users", logicalName: "User", x: 0, y: 0 });
  users.fields = [
    {
      id: "f_id",
      name: "id",
      fieldType: { type: "INT" },
      fieldTypeSource: "mapped",
    },
    {
      id: "f_email",
      name: "email",
      fieldType: { type: "VARCHAR", length: 100 },
      fieldTypeSource: "explicit",
    },
  ];
users.primaryKey = { id: "pk_users", name: "PK_users", logicalName: "PK_users", columns: [{ fieldId: "f_id" }] };
  diagram.tables = [users];
  return diagram;
}

function mountPanel() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const diagram = useDiagramStore();
  diagram.setDiagram(sampleDiagram());
  useUIStore().selectTable("t_users");
  const wrapper = mount(EditPanel, { global: { plugins: [pinia] } });
  return { wrapper, diagram };
}

function usersOf(diagram: ReturnType<typeof useDiagramStore>): Table {
  const found = diagram.diagram.tables.find((item) => item.id === "t_users");
  assert.ok(found, "the users table exists");
  return found;
}

describe("the primary key toggle of a field card", () => {
  it("adds a field to the primary key", async () => {
    const { wrapper, diagram } = mountPanel();
    const toggle = wrapper.find('[data-testid="field-primary-f_email"]');
    assert.ok(toggle.exists(), "the card of email offers the toggle");
    await toggle.setValue(true);
    const users = usersOf(diagram);
    assert.ok((users.primaryKey?.columns ?? []).some((column) => column.fieldId === users.fields[1]?.id));
  });

  it("drops a field out of the primary key", async () => {
    const { wrapper, diagram } = mountPanel();
    await wrapper.find('[data-testid="field-primary-f_id"]').setValue(false);
    const users = usersOf(diagram);
    assert.ok(!(users.primaryKey?.columns ?? []).some((column) => column.fieldId === users.fields[0]?.id));
  });
});
