/**
 * Tests for the creation action of the outline tree (P5 audit item 2).
 *
 * Replacing the side panel with the outline tree dropped the only entries
 * that created views, enums and custom types. The tree now offers a create
 * entry on those three categories; the action builds a default object and
 * runs it through the diagram-store commands, so it participates in undo.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { createEmptyDiagram } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import {
  CREATABLE_CATEGORIES,
  createOutlineNode,
  creatableCategoryOf,
  renameOutlineNode,
} from "./outline-actions.ts";

describe("createOutlineNode", () => {
  let pinia: Pinia;
  let store: ReturnType<typeof useDiagramStore>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    store = useDiagramStore();
    store.setDiagram(createEmptyDiagram());
  });

  it("names the three creatable categories and refuses the others", () => {
    assert.deepEqual([...CREATABLE_CATEGORIES], ["views", "enums", "types"]);
    assert.equal(creatableCategoryOf("views"), "views");
    assert.equal(creatableCategoryOf("tables"), null);
    assert.equal(creatableCategoryOf("notes"), null);
  });

  it("creates a view with a unique name and no columns", () => {
    createOutlineNode(store, "views");
    createOutlineNode(store, "views");

    assert.deepEqual(
      store.diagram.views.map((view) => view.name),
      ["view_1", "view_2"],
    );
    assert.deepEqual(store.diagram.views[0]?.columns, []);
  });

  it("creates an enum with an empty value list", () => {
    createOutlineNode(store, "enums");

    assert.equal(store.diagram.enums.length, 1);
    assert.equal(store.diagram.enums[0]?.name, "enum_1");
    assert.deepEqual(store.diagram.enums[0]?.values, []);
  });

  it("creates a custom type with no fields", () => {
    createOutlineNode(store, "types");

    assert.equal(store.diagram.types.length, 1);
    assert.equal(store.diagram.types[0]?.name, "type_1");
    assert.deepEqual(store.diagram.types[0]?.fields, []);
  });

  it("runs the creation through a command so undo removes it", () => {
    createOutlineNode(store, "views");
    assert.equal(store.diagram.views.length, 1);

    useHistoryStore().undo();

    assert.equal(store.diagram.views.length, 0);
  });

  it("ignores a category that has no create entry", () => {
    assert.equal(createOutlineNode(store, "tables"), null);
    assert.equal(store.diagram.tables.length, 0);
  });
});

describe("renameOutlineNode", () => {
  let pinia: Pinia;
  let store: ReturnType<typeof useDiagramStore>;

  const relationshipNode = {
    id: "relationship:r1",
    kind: "relationship" as const,
    label: "fk_orders_users",
    refId: "r1",
    matched: true,
    children: [],
  };

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    store = useDiagramStore();
    store.setDiagram({
      ...createEmptyDiagram(),
      tables: [
        {
          id: "t1",
          name: "orders",
          x: 0,
          y: 0,
          fields: [
            {
              id: "f1",
              name: "user_id",
              fieldType: { type: "INT" },
              fieldTypeSource: "explicit",
            },
          ],
          logical: { id: "le1", name: "Order", attributes: [] },
        },
        {
          id: "t2",
          name: "users",
          x: 0,
          y: 0,
          fields: [
            {
              id: "f2",
              name: "id",
              fieldType: { type: "INT" },
              fieldTypeSource: "explicit",
            },
          ],
          logical: { id: "le2", name: "User", attributes: [] },
        },
      ],
      relationships: [
        {
          id: "r1",
          startTableId: "t1",
          startFieldId: "f1",
          endTableId: "t2",
          endFieldId: "f2",
          name: "fk_orders_users",
        },
      ],
      logicalRelationships: [{ id: "r1", name: "places" }],
    });
  });

  it("writes the name of the layer the tree is in", () => {
    renameOutlineNode(store, relationshipNode, "orders the user", "logical");
    assert.equal(store.diagram.logicalRelationships?.[0]?.name, "orders the user");
    assert.equal(store.diagram.relationships[0]?.name, "fk_orders_users");

    renameOutlineNode(store, relationshipNode, "fk_orders_owner", "physical");
    assert.equal(store.diagram.relationships[0]?.name, "fk_orders_owner");
    assert.equal(store.diagram.logicalRelationships?.[0]?.name, "orders the user");
  });

  it("goes through the history, so one undo restores the name", () => {
    renameOutlineNode(store, relationshipNode, "orders the user", "logical");
    assert.equal(useHistoryStore().depth, 1);
    useHistoryStore().undo();
    assert.equal(store.diagram.logicalRelationships?.[0]?.name, "places");
  });
});
