import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { createEmptyDiagram, createTable } from "@drawdb/core";
import type { Diagram } from "@drawdb/core";
import { useDiagramStore } from "./diagram.ts";
import { useHistoryStore } from "./history.ts";

/**
 * The layout and alignment actions behind the toolbar (design 6.3 / 6.5):
 * one undo restores every table, and a locked table never moves (Q6).
 */
function sample(): Diagram {
  const diagram = createEmptyDiagram();
  const first = createTable({ id: "t_a", name: "a", x: 10, y: 10 });
  const second = createTable({ id: "t_b", name: "b", x: 300, y: 200 });
  const locked = createTable({ id: "t_c", name: "c", x: 900, y: 900 });
  locked.locked = true;
  diagram.tables = [first, second, locked];
  return diagram;
}

describe("arrange actions", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    useDiagramStore().setDiagram(sample());
  });

  const positions = () =>
    useDiagramStore().diagram.tables.map((table) => ({
      id: String(table.id),
      x: table.x,
      y: table.y,
    }));

  it("lays the unlocked tables out in a grid and leaves the locked one", () => {
    const store = useDiagramStore();

    assert.equal(store.layoutTables("grid", []), true);

    // Two tables take two columns of one row: 220 wide, a 60 gap.
    const after = positions();
    assert.deepEqual(after[0], { id: "t_a", x: 0, y: 0 });
    assert.deepEqual(after[1], { id: "t_b", x: 280, y: 0 });
    assert.deepEqual(after[2], { id: "t_c", x: 900, y: 900 });
  });

  it("restores every table with one undo", () => {
    const store = useDiagramStore();
    store.layoutTables("flow", []);

    useHistoryStore().undo();

    assert.deepEqual(positions(), [
      { id: "t_a", x: 10, y: 10 },
      { id: "t_b", x: 300, y: 200 },
      { id: "t_c", x: 900, y: 900 },
    ]);
  });

  it("aligns only the selected tables", () => {
    const store = useDiagramStore();

    assert.equal(store.alignTables("left", ["t_b"]), false);
    assert.equal(store.alignTables("left", ["t_a", "t_b"]), true);
    assert.deepEqual(
      positions().map((table) => table.x),
      [10, 10, 900],
    );
  });

  it("needs three tables to distribute", () => {
    const store = useDiagramStore();
    // A locked table refuses updates, so build three movable ones instead.
    const diagram = createEmptyDiagram();
    diagram.tables = ["t_a", "t_b", "t_c"].map((id, index) =>
      createTable({ id, name: id, x: index * 300, y: index * 100 }),
    );
    store.setDiagram(diagram);

    assert.equal(store.distributeTables("horizontal", ["t_a", "t_b"]), false);
    assert.equal(store.distributeTables("horizontal", ["t_a", "t_b", "t_c"]), true);
  });

  it("takes the selection, or every unlocked table", () => {
    const store = useDiagramStore();

    assert.deepEqual(
      store.targetTables([]).map((table) => String(table.id)),
      ["t_a", "t_b"],
    );
    assert.deepEqual(
      store.targetTables(["t_b"]).map((table) => String(table.id)),
      ["t_b"],
    );
  });

  it("keeps the whole-diagram auto arrange the header button uses", () => {
    const store = useDiagramStore();

    store.autoArrange();

    assert.equal(useHistoryStore().canUndo, true);
  });
});
