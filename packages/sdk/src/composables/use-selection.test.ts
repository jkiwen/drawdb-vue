import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { useSelection } from "./use-selection.ts";
import { useDiagramStore } from "../stores/diagram.ts";

function setUpDiagram() {
  const diagram = useDiagramStore();
  diagram.addTable({
    id: "t1",
    name: "users",
    x: 0,
    y: 0,
    logical: { id: "l_t1", name: "users", attributes: [] },
    fields: [],
  });
  diagram.addTable({
    id: "t2",
    name: "posts",
    x: 200,
    y: 0,
    logical: { id: "l_t2", name: "posts", attributes: [] },
    fields: [],
  });
  diagram.addRelationship({
    id: "r1",
    name: "fk_posts_user",
    startTableId: "t2",
    endTableId: "t1",
    startFieldId: "f1",
    endFieldId: "f2",
  });
  return diagram;
}

describe("useSelection", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("selects and deselects elements", () => {
    const { selectedIds, select, deselect, clear } = useSelection();

    select("t1");
    assert.ok(selectedIds.value.includes("t1"));

    deselect("t1");
    assert.ok(!selectedIds.value.includes("t1"));

    select("t1");
    select("t2");
    clear();
    assert.equal(selectedIds.value.length, 0);
  });

  it("resolves the kind of an id from the diagram", () => {
    setUpDiagram();
    const { select, selectedTables, selectedRelationships } = useSelection();

    select("t1");
    assert.deepEqual(selectedTables.value, ["t1"]);

    select("r1");
    assert.deepEqual(selectedRelationships.value, ["r1"]);
    assert.deepEqual(selectedTables.value, []);
  });

  it("replaces the selection unless the call is additive", () => {
    setUpDiagram();
    const { select, selectedIds } = useSelection();

    select("t1");
    select("t2");
    assert.deepEqual(selectedIds.value, ["t2"]);

    select("t1", { additive: true });
    assert.deepEqual(selectedIds.value.sort(), ["t1", "t2"]);
  });

  it("toggles an id", () => {
    setUpDiagram();
    const { toggle, isSelected, selectedIds } = useSelection();

    toggle("t1");
    assert.equal(isSelected("t1"), true);

    toggle("t1");
    assert.equal(isSelected("t1"), false);
    assert.equal(selectedIds.value.length, 0);
  });

  it("selects many ids at once", () => {
    setUpDiagram();
    const { selectMany, selectedIds } = useSelection();

    selectMany(["t1", "r1"], { additive: true });
    assert.deepEqual(selectedIds.value.sort(), ["r1", "t1"]);
  });

  it("reports whether anything is selected", () => {
    setUpDiagram();
    const { select, hasSelection, clear } = useSelection();

    assert.equal(hasSelection.value, false);
    select("t1");
    assert.equal(hasSelection.value, true);
    clear();
    assert.equal(hasSelection.value, false);
  });

  it("works without an active pinia by using a fallback instance", () => {
    setActivePinia(undefined as never);
    const { select, selectedIds } = useSelection();

    select("standalone");
    assert.deepEqual(selectedIds.value, ["standalone"]);
  });
});
