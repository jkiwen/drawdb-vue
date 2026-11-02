import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { useHistoryStore } from "./history.ts";

/**
 * The store of the history.
 *
 * The jump of the history is the feature the history tab of the bottom panel
 * drives: it walks the undo and the redo stack to an exact position, so the
 * diagram lands on the state of that step. The store keeps the reactive
 * mirrors of the command manager, and the tests pin both the state of the
 * diagram and the mirrors.
 */
describe("the history store", () => {
  let pinia: Pinia;
  let history: ReturnType<typeof useHistoryStore>;
  let applied: string[];

  /** A command that records that it ran and that it was undone. */
  function command(description: string) {
    return {
      description,
      execute() {
        applied.push(description);
      },
      undo() {
        applied.pop();
      },
    };
  }

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    history = useHistoryStore();
    applied = [];
  });

  it("starts empty", () => {
    assert.equal(history.depth, 0);
    assert.equal(history.canUndo, false);
    assert.equal(history.canRedo, false);
  });

  it("executes a command and mirrors the state of the manager", () => {
    history.execute(command("Add table"));
    assert.equal(history.depth, 1);
    assert.equal(history.canUndo, true);
    assert.equal(history.canRedo, false);
    assert.equal(history.undoDescription, "Add table");
    assert.deepEqual(applied, ["Add table"]);
  });

  it("undoes and redoes a command", () => {
    history.execute(command("Add table"));
    assert.equal(history.undo(), true);
    assert.equal(history.depth, 0);
    assert.equal(history.canRedo, true);
    assert.equal(history.redo(), true);
    assert.equal(history.depth, 1);
    assert.deepEqual(applied, ["Add table"]);
  });

  it("jumps back to an older step, undoing every step after it", () => {
    history.execute(command("Add table"));
    history.execute(command("Rename table"));
    history.execute(command("Add field"));

    assert.equal(history.jumpTo(1), true);
    assert.equal(history.depth, 1);
    assert.deepEqual(applied, ["Add table"]);
    assert.equal(history.canUndo, true);
    assert.equal(history.canRedo, true);
  });

  it("jumps forward again, redoing every step in between", () => {
    history.execute(command("Add table"));
    history.execute(command("Rename table"));
    history.jumpTo(1);

    assert.equal(history.jumpTo(2), true);
    assert.equal(history.depth, 2);
    assert.deepEqual(applied, ["Add table", "Rename table"]);
  });

  it("jumps to the position it is already at without running a command", () => {
    history.execute(command("Add table"));
    history.execute(command("Rename table"));

    assert.equal(history.jumpTo(2), true);
    assert.equal(history.depth, 2);
    assert.deepEqual(applied, ["Add table", "Rename table"]);
  });

  it("clamps a position that is out of reach", () => {
    history.execute(command("Add table"));
    history.execute(command("Rename table"));

    // The stack holds two commands; a position of five is not reachable, and
    // the jump lands on the last one.
    assert.equal(history.jumpTo(5), false);
    assert.equal(history.depth, 2);
    assert.equal(history.jumpTo(-3), false);
    assert.equal(history.depth, 0);
  });

  it("jumps over the boundary between the applied and the undone steps", () => {
    history.execute(command("Add table"));
    history.execute(command("Rename table"));
    history.undo();

    // One command is applied and one is undone; jumping to two redoes it.
    assert.equal(history.jumpTo(2), true);
    assert.deepEqual(applied, ["Add table", "Rename table"]);
  });

  it("lists the commands of the stack with the undone ones kept", () => {
    history.execute(command("Add table"));
    history.execute(command("Rename table"));
    history.undo();

    const snapshot = history.snapshot();
    assert.equal(snapshot.undoStack.length, 1);
    assert.equal(snapshot.redoStack.length, 1);
    assert.equal(snapshot.undoStack[0]?.description, "Add table");
    assert.equal(snapshot.redoStack[0]?.description, "Rename table");
  });

  it("clears the history", () => {
    history.execute(command("Add table"));
    history.clear();
    assert.equal(history.depth, 0);
    assert.equal(history.canUndo, false);
  });
});
