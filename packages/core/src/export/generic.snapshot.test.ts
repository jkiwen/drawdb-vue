import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "../models/diagram.ts";
import { toGeneric } from "./generic.ts";

// Snapshot of the exporter behaviour while it still used the hand-written
// genericMetadata table. The convergence to the type registry (spec §9.4-1)
// must preserve this output.
describe("toGeneric metadata snapshot", () => {
  it("keeps integer, decimal and text field output stable", () => {
    const diagram = createEmptyDiagram({ database: "generic" });
    diagram.tables.push({
      id: "t1",
      name: "snapshot",
      x: 0,
      y: 0,
      logical: { id: "le-t1", name: "snapshot", attributes: [] },
      fields: [
        {
          id: "f1",
          name: "n",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "explicit",
          notNull: true,
          default: 42,
        },
        {
          id: "f2",
          name: "amount",
          fieldType: { type: "DOUBLE PRECISION", precision: 10, scale: 2 },
          fieldTypeSource: "explicit",
        },
        {
          id: "f3",
          name: "note",
          fieldType: { type: "TEXT" },
          fieldTypeSource: "explicit",
          check: "LENGTH(note) > 0",
        },
        {
          id: "f4",
          name: "flag",
          fieldType: { type: "BOOLEAN" },
          fieldTypeSource: "explicit",
          default: "true",
        },
        {
          id: "f5",
          name: "label",
          fieldType: { type: "VARCHAR", length: 50 },
          fieldTypeSource: "explicit",
          default: "hello",
        },
      ],
    });
    const sql = toGeneric(diagram);
    assert.match(sql, /"n" INTEGER NOT NULL DEFAULT 42/);
    assert.match(sql, /"amount" DOUBLE PRECISION\(10,2\)/);
    assert.match(sql, /"note" TEXT CHECK\(LENGTH\(note\) > 0\)/);
    assert.match(sql, /"flag" BOOLEAN DEFAULT true/);
    assert.match(sql, /"label" VARCHAR\(50\) DEFAULT 'hello'/);
  });
});
