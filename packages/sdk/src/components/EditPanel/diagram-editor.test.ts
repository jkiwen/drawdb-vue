import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createEmptyDiagram } from "@drawdb/core";
import { DATABASE_OPTIONS } from "../../utils/database-options.ts";
import EditPanel from "./EditPanel.vue";
import { useDiagramStore } from "../../stores/diagram.ts";

function mountDiagramPanel() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const diagram = useDiagramStore();
  diagram.setDiagram(createEmptyDiagram({ title: "Sales" }));
  const wrapper = mount(EditPanel, { global: { plugins: [pinia] } });
  return { wrapper, diagram };
}

describe("the editor of the diagram", () => {
  it("lets the reader change the database of the diagram", async () => {
    const { wrapper, diagram } = mountDiagramPanel();

    const select = wrapper.find('[data-testid="diagram-database"]');
    assert.ok(select.exists(), "expected the database to be editable");
    assert.equal(
      select.findAll("option").length,
      DATABASE_OPTIONS.length,
      "expected every dialect as an option",
    );

    await select.setValue("postgres");

    assert.equal(diagram.diagram.database, "postgres");
  });

  it("keeps a description of the diagram", async () => {
    const { wrapper, diagram } = mountDiagramPanel();

    const field = wrapper.find('[data-testid="diagram-description"]');
    assert.ok(field.exists(), "expected a description field");
    await field.setValue("The selling side of the shop.");
    await field.trigger("change");

    assert.equal(diagram.diagram.description, "The selling side of the shop.");
  });
});
