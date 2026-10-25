import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { Diagram } from "@drawdb/core";
import Canvas from "./Canvas.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
// The dialog imports its stylesheet, and the stylesheet is global. Importing
// the dialog here is what puts the styles of the dialog into the document,
// the same way the editor does when it opens the dialog.
import RelationshipDialog from "../Dialogs/RelationshipDialog.vue";

/**
 * The relationship of the canvas and the dialog that creates a relationship.
 *
 * Both carry a class of its own, and the styles of the dialog are global: a
 * class that is used twice lets the styles of the dialog reach the nodes of
 * the canvas. The relationship of the canvas is then moved out of the visible
 * area of the canvas and the user sees no relationship at all.
 */
function seed(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "mysql",
    tables: [
      {
        id: "users",
        name: "users",
        x: 40,
        y: 60,
        fields: [
          { id: "users_id", name: "id", type: "INTEGER", primary: true },
        ],
      },
      {
        id: "posts",
        name: "posts",
        x: 420,
        y: 60,
        fields: [
          { id: "posts_id", name: "id", type: "INTEGER", primary: true },
          { id: "posts_user_id", name: "user_id", type: "INTEGER" },
        ],
      },
    ],
    relationships: [
      {
        id: "r1",
        startTableId: "posts",
        startFieldId: "posts_user_id",
        endTableId: "users",
        endFieldId: "users_id",
        name: "fk_posts_user",
        cardinality: "many_to_one",
      },
    ],
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

describe("the styles of the relationship", () => {
  it("does not move the relationship of the canvas out of the canvas", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useDiagramStore(pinia).setDiagram(seed());

    // The dialog is opened, so that its stylesheet is in the document.
    mount(RelationshipDialog, {
      props: { open: false },
      global: { plugins: [pinia, naive] },
    });

    const wrapper = mount(Canvas, {
      props: { width: 1200, height: 800 },
      global: { plugins: [pinia, naive] },
      attachTo: document.body,
    });

    const relationship = wrapper.find('[data-testid="relationship-r1"]');
    assert.ok(relationship.exists(), "the relationship is drawn");

    const style = window.getComputedStyle(relationship.element);
    // The styles of the dialog place the node in the middle of the screen.
    // The node of the canvas must not be placed at all.
    assert.equal(
      style.left,
      "auto",
      "the relationship of the canvas must not be placed with left",
    );
    assert.equal(
      style.position,
      "static",
      "the relationship of the canvas must not be positioned",
    );

    wrapper.unmount();
  });

  it("does not share the class of the canvas with the dialog", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useDiagramStore(pinia).setDiagram(seed());

    const canvas = mount(Canvas, {
      props: { width: 1200, height: 800 },
      global: { plugins: [pinia, naive] },
    });
    const dialog = mount(RelationshipDialog, {
      props: { open: true },
      global: { plugins: [pinia, naive] },
    });

    const canvasClasses = (
      canvas.find('[data-testid="relationship-r1"]').attributes("class") ?? ""
    ).split(/\s+/);
    const dialogClasses = (
      dialog.find('[data-testid="relationship-dialog"]').attributes("class") ?? ""
    ).split(/\s+/);

    const shared = canvasClasses.filter((name) => dialogClasses.includes(name));
    assert.deepEqual(
      shared,
      [],
      `the canvas and the dialog must not share a class: ${shared.join(", ")}`,
    );
  });
});
