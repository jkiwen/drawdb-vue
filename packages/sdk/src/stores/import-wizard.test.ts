import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { useDiagramStore } from "./diagram.ts";
import { useHistoryStore } from "./history.ts";
import { useImportWizardStore } from "./import-wizard.ts";

const SQL = "CREATE TABLE users (id INT NOT NULL, email VARCHAR(64), PRIMARY KEY (id));";

function setup(): { wizard: ReturnType<typeof useImportWizardStore>; diagram: ReturnType<typeof useDiagramStore>; history: ReturnType<typeof useHistoryStore> } {
  const pinia = createPinia();
  setActivePinia(pinia);
  return {
    wizard: useImportWizardStore(),
    diagram: useDiagramStore(),
    history: useHistoryStore(),
  };
}

describe("the import wizard", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("cannot move on before it has read something", () => {
    const { wizard } = setup();
    wizard.begin("sql");
    assert.equal(wizard.step, "source");
    assert.equal(wizard.canNext, false);
  });

  it("starts from the file a drop handed over (P8 task 8)", () => {
    const { wizard } = setup();
    wizard.begin("sql", undefined, { text: SQL, fileName: "shop.sql" });
    assert.equal(wizard.text, SQL);
    assert.equal(wizard.fileName, "shop.sql");
    wizard.advance();
    assert.equal(wizard.step, "report");
    assert.equal(wizard.plan?.adds.tables, 1);
  });

  it("wipes the previous run when it opens again", () => {
    const { wizard } = setup();
    wizard.begin("sql", undefined, { text: SQL, fileName: "shop.sql" });
    wizard.advance();
    wizard.begin("dbml");
    assert.equal(wizard.text, "");
    assert.equal(wizard.fileName, undefined);
    assert.equal(wizard.step, "source");
    assert.equal(wizard.plan, null);
  });

  it("reads the file and reports what it found", () => {
    const { wizard } = setup();
    wizard.begin("sql");
    wizard.text = SQL;
    wizard.advance();
    assert.equal(wizard.step, "report");
    assert.equal(wizard.plan?.adds.tables, 1);
    assert.equal(wizard.canNext, true);
  });

  it("asks where the import goes and what to do with a clash", () => {
    const { wizard, diagram } = setup();
    diagram.addTable({
      id: "t_users",
      name: "users",
      x: 0,
      y: 0,
      fields: [],
      logical: { id: "l_users", name: "users", attributes: [] },
    } as never);
    wizard.begin("sql");
    wizard.text = SQL;
    wizard.advance();
    wizard.advance();
    assert.equal(wizard.step, "target");
    wizard.advance();
    assert.equal(wizard.step, "conflict");
    assert.deepEqual(wizard.plan?.conflicts.map((conflict) => conflict.id), ["table:users"]);
    assert.equal(wizard.canNext, false);
    assert.match(wizard.reasons.join(" "), /1 conflict\(s\) need a decision/);
    wizard.decide("table:users", "merge");
    assert.equal(wizard.canNext, true);
  });

  it("imports as one step that undo takes back out", () => {
    const { wizard, diagram, history } = setup();
    const before = JSON.parse(JSON.stringify(diagram.diagram)) as typeof diagram.diagram;
    wizard.begin("sql");
    wizard.text = SQL;
    for (let step = 0; step < 4; step += 1) wizard.advance();
    assert.equal(wizard.step, "apply");
    assert.equal(wizard.apply(), true);
    assert.equal(diagram.diagram.tables.length, 1);
    assert.equal(diagram.diagram.tables[0]?.name, "users");
    assert.equal(history.canUndo, true);
    assert.equal(history.undoDescription?.includes("Import"), true);
    history.undo();
    assert.deepEqual(diagram.diagram.tables, before.tables);
  });

  it("keeps the record of the import in the diagram", () => {
    const { wizard, diagram } = setup();
    wizard.begin("sql");
    wizard.text = SQL;
    for (let step = 0; step < 4; step += 1) wizard.advance();
    wizard.apply();
    const session = diagram.diagram.imports?.[0];
    assert.equal(session?.outcome, "applied");
    assert.equal(session?.source.format, "sql");
    assert.equal(session?.counts.tables, 1);
    assert.equal(session?.target.kind, "current");
  });

  it("starts a new diagram from the file when asked", () => {
    const { wizard, diagram } = setup();
    diagram.addTable({
      id: "t_old",
      name: "old",
      x: 0,
      y: 0,
      fields: [],
      logical: { id: "l_old", name: "old", attributes: [] },
    } as never);
    wizard.begin("sql");
    wizard.text = SQL;
    wizard.advance();
    wizard.advance();
    wizard.setTarget("new");
    wizard.advance();
    wizard.apply();
    assert.deepEqual(diagram.diagram.tables.map((table) => table.name), ["users"]);
  });
});
