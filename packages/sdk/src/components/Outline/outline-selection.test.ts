import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutlineNode } from "./outline-model.ts";
import {
  outlineFocusOf,
  outlineSelectionId,
  selectOutlineNode,
  type OutlineSelectionStore,
} from "./outline-selection.ts";

/**
 * The selection of the outline tree, out of the component: the id of the
 * selected node, the selection a node writes in the ui store and the focus
 * it produces.
 */
function fakeStore(): OutlineSelectionStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    selectedFields: [],
    selectedTableIds: [],
    selectedRelationshipIds: [],
    selectedNoteIds: [],
    selectedAreaIds: [],
    selectTable: (id) => calls.push(`table:${id}`),
    selectRelationship: (id) => calls.push(`relationship:${id}`),
    selectNote: (id) => calls.push(`note:${id}`),
    selectArea: (id) => calls.push(`area:${id}`),
    selectField: (tableId, fieldId) => calls.push(`field:${tableId}.${fieldId}`),
  };
}

function node(partial: Partial<OutlineNode> & { id: string }): OutlineNode {
  return {
    kind: "table",
    label: "",
    matched: true,
    children: [],
    ...partial,
  } as OutlineNode;
}

describe("the selection of the outline", () => {
  it("reads the last selected field before anything else", () => {
    const store = fakeStore();
    store.selectedFields = [{ tableId: "t1", fieldId: "f1" }];
    store.selectedTableIds = ["t2"];
    assert.equal(outlineSelectionId(store), "field:t1:f1");
  });

  it("reads the last selected table, relationship, note and area", () => {
    const store = fakeStore();
    store.selectedTableIds = ["t1", "t2"];
    assert.equal(outlineSelectionId(store), "table:t2");
    store.selectedTableIds = [];
    store.selectedRelationshipIds = ["r1"];
    assert.equal(outlineSelectionId(store), "relationship:r1");
    store.selectedRelationshipIds = [];
    store.selectedNoteIds = ["n1"];
    assert.equal(outlineSelectionId(store), "note:n1");
    store.selectedNoteIds = [];
    store.selectedAreaIds = ["a1"];
    assert.equal(outlineSelectionId(store), "area:a1");
    store.selectedAreaIds = [];
    assert.equal(outlineSelectionId(store), undefined);
  });

  it("selects the table of a field and focuses it", () => {
    const store = fakeStore();
    const focus = selectOutlineNode(
      store,
      node({ id: "field:t1:f1", kind: "field", refId: "f1", parentRefId: "t1" }),
    );
    assert.deepEqual(store.calls, ["field:t1.f1"]);
    assert.deepEqual(focus, { kind: "field", id: "f1", tableId: "t1" });
  });

  it("selects the table and the relationship of a foreign key", () => {
    const store = fakeStore();
    const focus = selectOutlineNode(
      store,
      node({
        id: "constraint:t1:foreign:r1",
        kind: "constraint",
        refId: "r1",
        parentRefId: "t1",
      }),
    );
    assert.deepEqual(store.calls, ["table:t1", "relationship:r1"]);
    assert.deepEqual(focus, { kind: "table", id: "t1" });
  });

  it("focuses the table of an area-table", () => {
    const store = fakeStore();
    const focus = selectOutlineNode(
      store,
      node({ id: "area:a1:table:t1", kind: "area-table", refId: "t1" }),
    );
    assert.deepEqual(store.calls, ["table:t1"]);
    assert.deepEqual(focus, { kind: "table", id: "t1" });
  });

  it("focuses a view without selecting anything", () => {
    const store = fakeStore();
    const focus = selectOutlineNode(
      store,
      node({ id: "view:v1", kind: "view", refId: "v1" }),
    );
    assert.deepEqual(store.calls, []);
    assert.deepEqual(focus, { kind: "view", id: "v1" });
  });

  it("computes the focus of a node without touching the store", () => {
    assert.deepEqual(
      outlineFocusOf(node({ id: "note:n1", kind: "note", refId: "n1" })),
      { kind: "note", id: "n1" },
    );
  });
});
