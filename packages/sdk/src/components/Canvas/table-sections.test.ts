import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Table } from "@drawdb/core";
import {
  foreignKeyRows,
  TABLE_SECTION_LABEL_HEIGHT,
  TABLE_SECTION_LINE_HEIGHT,
  TABLE_SECTION_PADDING_Y,
  tableSections,
  tableSectionsHeight,
} from "./table-sections.ts";
import { tableRenderModel } from "./render-model.ts";
import { TABLE_FIELD_HEIGHT, TABLE_HEADER_HEIGHT } from "./geometry.ts";

/*
 * The display blocks of a table node (section 7 of the UI document).
 *
 * The keys, the indices and the description of a table are drawn *below*
 * the field list, one block each, in the order PK, FK, UK, INDEX and the
 * description, and the table grows to fit them.
 */

const toggles = {
  description: true,
  fields: true,
  pkUkFk: true,
  indexes: true,
};

function makeTable(patch: Partial<Table> = {}): Table {
  return {
    id: "t1",
    name: "users",
    x: 0,
    y: 0,
    fields: [
      {
        id: "f1",
        name: "id",
        fieldType: { type: "INTEGER" },
        fieldTypeSource: "mapped",
        primary: true,
      },
      {
        id: "f2",
        name: "email",
        fieldType: { type: "VARCHAR", length: 255 },
        fieldTypeSource: "mapped",
        unique: true,
      },
      {
        id: "f3",
        name: "org_id",
        fieldType: { type: "INTEGER" },
        fieldTypeSource: "mapped",
      },
    ],
    logical: {
      id: "l1",
      name: "user",
      description: "A person who can sign in.",
      attributes: [
        {
          id: "a1",
          name: "identifier",
          logicalType: { family: "integer" },
          fieldId: "f1",
          keyRole: "primary",
        },
        {
          id: "a2",
          name: "email address",
          logicalType: { family: "string" },
          fieldId: "f2",
          keyRole: "alternate",
        },
        {
          id: "a3",
          name: "organisation",
          logicalType: { family: "integer" },
          fieldId: "f3",
          keyRole: "foreign",
        },
      ],
    },
    comment: "The people table",
    indices: [
      { id: "i1", name: "idx_email", unique: false, fields: ["f2"] },
      { id: "i2", name: "idx_org", unique: true, fields: ["f3"] },
    ],
    uniqueConstraints: [{ id: "u1", name: "uk_email", fields: ["f2"] }],
    ...patch,
  } as Table;
}

function kinds(table: Table, layer: "logical" | "physical" = "physical") {
  return tableSections({
    table,
    layer,
    toggles,
    width: 220,
    foreignKeys: ["fk_posts_user: org_id → organisations.id"],
  }).map((section) => section.kind);
}

function sectionOf(table: Table, kind: string, layer: "logical" | "physical" = "physical") {
  return tableSections({
    table,
    layer,
    toggles,
    width: 220,
    foreignKeys: ["fk_posts_user: org_id → organisations.id"],
  }).find((section) => section.kind === kind);
}

describe("tableSections", () => {
  it("draws the keys and the indices below the fields in a fixed order", () => {
    assert.deepEqual(kinds(makeTable()), [
      "primary",
      "foreign",
      "unique",
      "index",
      "description",
    ]);
  });

  it("labels each key block and leaves the description unlabelled", () => {
    const table = makeTable();
    assert.equal(sectionOf(table, "primary")?.label, "PK");
    assert.equal(sectionOf(table, "foreign")?.label, "FK");
    assert.equal(sectionOf(table, "unique")?.label, "UK");
    assert.equal(sectionOf(table, "index")?.label, "INDEX");
    assert.equal(sectionOf(table, "description")?.label, null);
  });

  it("lists the primary key, the foreign keys, the unique keys and the indices", () => {
    const table = makeTable();
    assert.deepEqual(sectionOf(table, "primary")?.lines, ["id"]);
    assert.deepEqual(sectionOf(table, "foreign")?.lines, [
      "fk_posts_user: org_id → organisations.id",
    ]);
    assert.deepEqual(sectionOf(table, "unique")?.lines, ["uk_email (email)"]);
    assert.deepEqual(sectionOf(table, "index")?.lines, [
      "idx_email (email)",
      "idx_org (org_id) UNIQUE",
    ]);
  });

  it("keeps the description of the layer as the text of the last block", () => {
    const table = makeTable();
    assert.equal(sectionOf(table, "description")?.text, "The people table");
    assert.deepEqual(sectionOf(table, "description")?.lines, []);
    assert.equal(
      tableSections({ table, layer: "logical", toggles, width: 220 }).at(-1)?.text,
      "A person who can sign in.",
    );
  });

  it("skips a block that has nothing to show", () => {
    const table = makeTable({
      fields: [
        {
          id: "f1",
          name: "id",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "mapped",
        },
      ],
      indices: [],
      uniqueConstraints: [],
      comment: undefined,
    } as Partial<Table>);
    assert.deepEqual(kinds(table), ["foreign"]);
  });

  it("follows the display toggles", () => {
    const table = makeTable();
    const keysOff = tableSections({
      table,
      layer: "physical",
      toggles: { ...toggles, pkUkFk: false },
      width: 220,
    });
    assert.ok(!keysOff.some((section) => section.kind === "primary"));
    const indexesOff = tableSections({
      table,
      layer: "physical",
      toggles: { ...toggles, indexes: false },
      width: 220,
    });
    assert.ok(!indexesOff.some((section) => section.kind === "index"));
    const descriptionOff = tableSections({
      table,
      layer: "physical",
      toggles: { ...toggles, description: false },
      width: 220,
    });
    assert.ok(!descriptionOff.some((section) => section.kind === "description"));
  });

  it("reads the keys of the logical layer from the attributes", () => {
    const table = makeTable({ indices: [], uniqueConstraints: [] } as Partial<Table>);
    const sections = tableSections({
      table,
      layer: "logical",
      toggles,
      width: 220,
    });
    assert.deepEqual(sections.map((section) => section.kind), [
      "primary",
      "foreign",
      "unique",
      "description",
    ]);
    assert.deepEqual(sections[0]?.lines, ["identifier"]);
    assert.deepEqual(sections[2]?.lines, ["email address"]);
  });

  it("measures a block: a label line, one line per row and a padding", () => {
    const table = makeTable();
    const primary = sectionOf(table, "primary");
    assert.equal(
      primary?.height,
      TABLE_SECTION_LABEL_HEIGHT + TABLE_SECTION_LINE_HEIGHT + TABLE_SECTION_PADDING_Y,
    );
    const index = sectionOf(table, "index");
    assert.equal(
      index?.height,
      TABLE_SECTION_LABEL_HEIGHT + 2 * TABLE_SECTION_LINE_HEIGHT + TABLE_SECTION_PADDING_Y,
    );
  });

  it("measures the description by the width of the table", () => {
    const table = makeTable();
    const narrow = tableSections({ table, layer: "physical", toggles, width: 220 });
    const wide = tableSections({ table, layer: "physical", toggles, width: 1200 });
    assert.equal(narrow.at(-1)?.height, wide.at(-1)?.height);
    const long = makeTable({ comment: "x".repeat(200) } as Partial<Table>);
    const narrowLong = tableSections({ table: long, layer: "physical", toggles, width: 220 });
    const wideLong = tableSections({ table: long, layer: "physical", toggles, width: 1200 });
    assert.ok((narrowLong.at(-1)?.height ?? 0) > (wideLong.at(-1)?.height ?? 0));
  });

  it("sums the height of the blocks", () => {
    const table = makeTable();
    const sections = tableSections({ table, layer: "physical", toggles, width: 220 });
    const total = sections.reduce((sum, section) => sum + section.height, 0);
    assert.equal(tableSectionsHeight(sections), total);
    assert.ok(total > 0);
  });
});

describe("the render model with the blocks", () => {
  it("draws the title bar alone in the header and grows by the blocks", () => {
    const table = makeTable();
    const model = tableRenderModel(table, "physical", toggles, {
      foreignKeys: ["fk_posts_user: org_id → organisations.id"],
    });
    assert.equal(model.headerHeight, TABLE_HEADER_HEIGHT);
    assert.equal(model.sections.length, 5);
    assert.equal(
      model.height,
      TABLE_HEADER_HEIGHT +
        model.rows.length * TABLE_FIELD_HEIGHT +
        model.sectionsHeight,
    );
  });

  it("keeps the description out of the header", () => {
    const table = makeTable();
    const model = tableRenderModel(table, "physical", toggles);
    assert.equal(model.headerHeight, TABLE_HEADER_HEIGHT);
    assert.equal(model.sections.at(-1)?.kind, "description");
    assert.equal(model.sections.at(-1)?.text, "The people table");
  });
});

describe("foreignKeyRows", () => {
  it("draws one row per relationship that leaves the table", () => {
    const table = makeTable({
      fields: [
        {
          id: "f3",
          name: "org_id",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "mapped",
        },
      ],
    } as Partial<Table>);
    const other = {
      id: "t2",
      name: "organisations",
      x: 0,
      y: 0,
      fields: [
        {
          id: "g1",
          name: "id",
          fieldType: { type: "INTEGER" },
          fieldTypeSource: "mapped",
        },
      ],
      logical: { id: "l2", name: "organisation", attributes: [] },
    } as unknown as Table;
    const rows = foreignKeyRows(
      table,
      [
        {
          id: "r1",
          name: "fk_org",
          startTableId: "t1",
          startFieldId: "f3",
          endTableId: "t2",
          endFieldId: "g1",
        },
        {
          id: "r2",
          name: "incoming",
          startTableId: "t2",
          startFieldId: "g1",
          endTableId: "t1",
          endFieldId: "f3",
        },
      ] as never,
      [table, other],
    );
    assert.deepEqual(rows, ["fk_org: org_id → organisations.id"]);
  });
});
