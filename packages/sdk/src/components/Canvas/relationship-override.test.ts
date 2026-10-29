import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { useDiagramStore } from "../../stores/diagram.ts";
import Relationship from "./Relationship.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

/**
 * The anchor of a relationship follows the node the canvas draws.
 *
 * Ruling Q1 lets the toolbar collapse a selection of tables on its own: the
 * table node then shrinks to its header while the rest of the canvas keeps
 * the global display. The relationship must measure its end with the same
 * override, or the dot stays where the old, taller node ended.
 */

function seed(pinia: ReturnType<typeof createPinia>) {
  setActivePinia(pinia);
  const diagram = useDiagramStore();

  for (const [id, x] of [["t1", 100], ["t2", 500]] as const) {
    diagram.addTable({
      id,
      name: id,
      x,
      y: 100,
      logical: { id: `l_${id}`, name: id, attributes: [] },
      fields: [
        { id: `${id}_id`, name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", notNull: true },
        { id: `${id}_name`, name: "name", fieldType: { type: "VARCHAR", length: 255 }, fieldTypeSource: "explicit" },
        { id: `${id}_mail`, name: "mail", fieldType: { type: "VARCHAR", length: 255 }, fieldTypeSource: "explicit" },
      ],
      primaryKey: {
        id: `pk_${id}`,
        name: `PK_${id}`,
        logicalName: `PK_${id}`,
        columns: [{ fieldId: `${id}_id` }],
      },
    });
  }

  diagram.addRelationship({
    id: "r1",
    name: "fk_t2_t1",
    startTableId: "t2",
    startFieldId: "t2_id",
    endTableId: "t1",
    endFieldId: "t1_id",
  });

  return diagram;
}

function pathY(wrapper: ReturnType<typeof mount>, which: "start" | "end"): number {
  const d = wrapper.find('[data-testid="relationship-r1"] path').attributes("d") ?? "";
  // "M 560 234 C ... , 340 198"
  const numbers = d.replace(/[MCL]/g, " ").trim().split(/\s+/).map(Number);
  return which === "start" ? numbers[1]! : numbers[numbers.length - 1]!;
}

function mountRelationship(pinia: ReturnType<typeof createPinia>) {
  const diagram = useDiagramStore(pinia);
  return mount(Relationship, {
    props: {
      relationship: diagram.relationships[0]!,
      startTable: diagram.tableById("t2")!,
      endTable: diagram.tableById("t1")!,
    },
    global: { plugins: [pinia, naive] },
  });
}

describe("the anchor of a relationship", () => {
  it("stays on the row of the field in the full view", () => {
    const pinia = createPinia();
    seed(pinia);
    const wrapper = mountRelationship(pinia);
    // The header is 50 tall and the first row is 36, so the field sits at
    // 100 + 50 + 18 = 168 on both ends.
    assert.equal(pathY(wrapper, "end"), 168);
    assert.equal(pathY(wrapper, "start"), 168);
  });

  it("follows a table the toolbar collapsed on its own", () => {
    const pinia = createPinia();
    const diagram = seed(pinia);
    diagram.updateViewState({
      overrides: {
        t1: { description: false, fields: false, pkUkFk: false, indexes: false },
      },
    });
    const wrapper = mountRelationship(pinia);

    // t1 is only its 50 tall header: the anchor clamps to its bottom edge.
    assert.equal(pathY(wrapper, "start"), 168, "t2 keeps its row");
    assert.equal(pathY(wrapper, "end"), 150);
  });
});
